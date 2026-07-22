import type { Context, MiddlewareHandler } from 'hono'
import { createMiddleware } from 'hono/factory'
import type { SessionContainer } from 'supertokens-node/recipe/session'
import type { VerifySessionOptions } from 'supertokens-node/recipe/session/types'
import type { HTTPMethod } from 'supertokens-node/types'
import type { CookieInfo } from 'supertokens-node/lib/build/framework/custom/framework'
import {
  PreParsedRequest,
  CollectingResponse,
  middleware as stMiddleware,
  errorHandler as stErrorHandler,
} from 'supertokens-node/framework/custom'

// ─── Type augmentation ────────────────────────────────────────────────────────

declare module 'hono' {
  interface ContextVariableMap {
    session: SessionContainer | undefined
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const eqIdx = part.indexOf('=')
    if (eqIdx === -1) continue
    const key = decodeURIComponent(part.slice(0, eqIdx).trim())
    const val = decodeURIComponent(part.slice(eqIdx + 1).trim())
    out[key] = val
  }
  return out
}

function serializeCookie(info: CookieInfo): string {
  let str = `${encodeURIComponent(info.key)}=${encodeURIComponent(info.value)}`
  if (info.domain) str += `; Domain=${info.domain}`
  if (info.path) str += `; Path=${info.path}`
  if (info.expires) str += `; Expires=${new Date(info.expires).toUTCString()}`
  if (info.secure) str += '; Secure'
  if (info.httpOnly) str += '; HttpOnly'
  if (info.sameSite) str += `; SameSite=${info.sameSite.charAt(0).toUpperCase() + info.sameSite.slice(1)}`
  return str
}

async function buildPreParsedRequest(c: Context): Promise<PreParsedRequest> {
  const req = c.req.raw
  const url = new URL(req.url)

  const headers = new Headers()
  req.headers.forEach((v, k) => {
    headers.set(k, v)
  })

  return new PreParsedRequest({
    method: req.method.toLowerCase() as HTTPMethod,
    url: req.url,
    query: Object.fromEntries(url.searchParams.entries()),
    headers,
    cookies: parseCookies(req.headers.get('cookie')),
    getFormBody: () => req.clone().formData(),
    getJSONBody: () => req.clone().json(),
  })
}

function applyCollectingResponse(stRes: CollectingResponse, base: Response): Response {
  const headers = new Headers(base.headers)

  stRes.headers.forEach((value: string, name: string) => {
    headers.set(name, value)
  })

  for (const cookie of stRes.cookies) {
    headers.append('set-cookie', serializeCookie(cookie))
  }

  return new Response(base.body, { status: base.status, headers })
}

function hasResponseUpdates(stRes: CollectingResponse): boolean {
  let hasHeaders = false
  stRes.headers.forEach(() => {
    hasHeaders = true
  })
  return hasHeaders || stRes.cookies.length > 0
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Middleware that handles all SuperTokens-managed auth routes (sign-in, sign-up,
 * sign-out, refresh, etc.).
 *
 * Mount on the same path as `appInfo.apiBasePath` (default `/auth`).
 * Unrecognised paths are forwarded to the next Hono handler.
 *
 * Requires `SuperTokens.init({ framework: 'custom', ... })` to be called before
 * any request reaches this middleware.
 *
 * @example
 * ```ts
 * import SuperTokens from 'supertokens-node'
 * import Session from 'supertokens-node/recipe/session'
 * import EmailPassword from 'supertokens-node/recipe/emailpassword'
 * import { Hono } from 'hono'
 * import { cors } from 'hono/cors'
 * import { superTokensMiddleware, verifySession, getSession } from '@hono/supertokens'
 *
 * SuperTokens.init({
 *   framework: 'custom',
 *   supertokens: { connectionURI: 'http://localhost:3567' },
 *   appInfo: {
 *     appName: 'My App',
 *     apiDomain: 'http://localhost:3000',
 *     websiteDomain: 'http://localhost:5173',
 *   },
 *   recipeList: [EmailPassword.init(), Session.init()],
 * })
 *
 * const app = new Hono()
 *
 * app.use('*', cors({
 *   origin: 'http://localhost:5173',
 *   allowHeaders: ['content-type', ...SuperTokens.getAllCORSHeaders()],
 *   credentials: true,
 * }))
 *
 * app.use('/auth/*', superTokensMiddleware())
 *
 * app.get('/protected', verifySession(), (c) => {
 *   const userId = c.get('session')!.getUserId()
 *   return c.json({ userId })
 * })
 * ```
 */
export function superTokensMiddleware(): MiddlewareHandler {
  return createMiddleware(async (c, next) => {
    const baseReq = await buildPreParsedRequest(c)
    const baseRes = new CollectingResponse()

    let result: { handled: boolean; error?: unknown } | { error: unknown; handled?: boolean }
    try {
      result = await stMiddleware()(baseReq, baseRes, async () => {})
    } catch (err: unknown) {
      const errRes = new CollectingResponse()
      await stErrorHandler()(err, baseReq, errRes, () => {})
      const body = errRes.body ?? JSON.stringify({ message: 'Authentication error' })
      return applyCollectingResponse(errRes, new Response(body, { status: errRes.statusCode ?? 500 }))
    }

    if (result.error !== undefined) {
      const errRes = new CollectingResponse()
      await stErrorHandler()(result.error, baseReq, errRes, () => {})
      const body = errRes.body ?? JSON.stringify({ message: 'Authentication error' })
      return applyCollectingResponse(errRes, new Response(body, { status: errRes.statusCode ?? 500 }))
    }

    if (result.handled) {
      const body = baseRes.body ?? ''
      return applyCollectingResponse(baseRes, new Response(body, { status: baseRes.statusCode ?? 200 }))
    }

    await next()

    if (c.res && hasResponseUpdates(baseRes)) {
      c.res = applyCollectingResponse(baseRes, c.res)
    }
  })
}

/**
 * Middleware that verifies the caller holds a valid SuperTokens session.
 *
 * On success the `SessionContainer` is stored in `c.var.session` and accessible
 * via `c.get('session')` or `getSession(c)`.
 *
 * On failure a `401 Unauthorized` JSON response is returned. When
 * `sessionRequired: false` is passed the middleware still runs but a missing
 * session is not an error — `c.get('session')` will be `undefined`.
 *
 * @example
 * ```ts
 * // Require a session
 * app.get('/me', verifySession(), (c) => {
 *   const session = getSession(c)
 *   return c.json({ userId: session.getUserId() })
 * })
 *
 * // Optional session
 * app.get('/feed', verifySession({ sessionRequired: false }), (c) => {
 *   const session = c.get('session')
 *   return c.json({ loggedIn: session !== undefined })
 * })
 * ```
 */
export function verifySession(options?: VerifySessionOptions): MiddlewareHandler {
  return createMiddleware(async (c, next) => {
    const Session = (await import('supertokens-node/recipe/session')).default

    const baseReq = await buildPreParsedRequest(c)
    const baseRes = new CollectingResponse()

    try {
      const session = await Session.getSession(baseReq, baseRes, options)
      c.set('session', session ?? undefined)

      await next()

      if (c.res && hasResponseUpdates(baseRes)) {
        c.res = applyCollectingResponse(baseRes, c.res)
      }
    } catch (err: unknown) {
      if (err instanceof Error && Session.Error.isErrorFromSuperTokens(err)) {
        const stErr = err as Error & { type: string }
        const isTryRefresh = stErr.type === Session.Error.TRY_REFRESH_TOKEN
        return c.json(
          {
            message: isTryRefresh
              ? 'Session expired. Please call the session refresh endpoint and retry.'
              : 'Unauthorized',
          },
          401
        )
      }
      throw err
    }
  })
}

/**
 * Retrieve the `SessionContainer` stored by `verifySession()`.
 *
 * Throws if called before `verifySession()` has run, or when
 * `sessionRequired: false` was used and no session is present.
 *
 * @example
 * ```ts
 * app.get('/me', verifySession(), (c) => {
 *   const session = getSession(c)
 *   return c.json({ userId: session.getUserId() })
 * })
 * ```
 */
export function getSession(c: Context): SessionContainer {
  const session = c.get('session')
  if (session === undefined) {
    throw new Error(
      '[hono-supertokens] No session found in context. Make sure verifySession() middleware has run.'
    )
  }
  return session
}
