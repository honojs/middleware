import type { Context, MiddlewareHandler } from 'hono'
import { env } from 'hono/adapter'
import { createMiddleware } from 'hono/factory'
import type { TypeInput as SuperTokensConfig } from 'supertokens-node/types'
import type { SessionContainer } from 'supertokens-node/recipe/session'
import type { VerifySessionOptions } from 'supertokens-node/recipe/session/types'
import {
  PreParsedRequest,
  CollectingResponse,
  middleware as stMiddleware,
  errorHandler as stErrorHandler,
} from 'supertokens-node/framework/custom'

// ─── Type augmentation ────────────────────────────────────────────────────────

declare module 'hono' {
  interface ContextVariableMap {
    session: SessionContainer
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Parse the Cookie header into a plain key-value record.
 */
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

/**
 * Build a SuperTokens PreParsedRequest from a Hono Context.
 */
async function buildPreParsedRequest(c: Context): Promise<PreParsedRequest> {
  const req = c.req.raw
  const url = new URL(req.url)

  const headers: Record<string, string> = {}
  req.headers.forEach((v, k) => {
    headers[k] = v
  })

  return new PreParsedRequest({
    method: req.method.toLowerCase() as PreParsedRequest['method'],
    url: req.url,
    query: Object.fromEntries(url.searchParams.entries()),
    headers,
    cookies: parseCookies(req.headers.get('cookie')),
    getFormBody: () => req.clone().formData(),
    getJSONBody: () => req.clone().json(),
  })
}

/**
 * Apply Set-Cookie and other headers from a CollectingResponse back onto
 * a standard Response, returning a new Response.
 */
function applyCollectingResponse(stRes: CollectingResponse, base: Response): Response {
  const headers = new Headers(base.headers)

  stRes.headers.forEach((values, name) => {
    // Replace the first occurrence, then append the rest
    let first = true
    for (const value of values) {
      if (first) {
        headers.set(name, value)
        first = false
      } else {
        headers.append(name, value)
      }
    }
  })

  for (const cookie of stRes.cookies) {
    headers.append('set-cookie', cookie)
  }

  return new Response(base.body, { status: base.status, headers })
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface SuperTokensOptions {
  /** Override the connection URI; defaults to process.env.SUPERTOKENS_CONNECTION_URI */
  connectionURI?: string
  /** Override the API key; defaults to process.env.SUPERTOKENS_API_KEY */
  apiKey?: string
}

/**
 * Initialise SuperTokens and return the auth-route middleware.
 *
 * Mount this on the same path as `appInfo.apiBasePath` (default `/auth`).
 * It intercepts all SuperTokens-managed routes (sign-in, sign-up, sign-out,
 * refresh, etc.) and forwards unrecognised paths to the next handler.
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
 *   const userId = c.get('session').getUserId()
 *   return c.json({ userId })
 * })
 * ```
 */
export function superTokensMiddleware(): MiddlewareHandler {
  return createMiddleware(async (c, next) => {
    const baseReq = await buildPreParsedRequest(c)
    const baseRes = new CollectingResponse()

    // We use a noop for the ST middleware's `next` parameter — SuperTokens
    // uses it only to determine whether it handled the request, and we manage
    // the Hono continuation ourselves below.
    const result = await stMiddleware()(baseReq, baseRes, async () => {})

    if (result.error !== undefined) {
      // Let SuperTokens convert the error into a proper HTTP response
      const errRes = new CollectingResponse()
      await stErrorHandler()(result.error, baseReq, errRes, () => {})
      const body = errRes.body ?? JSON.stringify({ message: 'Authentication error' })
      return applyCollectingResponse(errRes, new Response(body, { status: errRes.statusCode ?? 500 }))
    }

    if (result.handled) {
      // SuperTokens generated a response (e.g. sign-in / refresh)
      const body = baseRes.body ?? ''
      return applyCollectingResponse(baseRes, new Response(body, { status: baseRes.statusCode ?? 200 }))
    }

    // Not a SuperTokens route — pass to the next Hono handler
    await next()

    // Merge any token updates (e.g. refreshed access-token cookie) written by
    // SuperTokens into the response after the downstream handler has run
    if (c.res && (baseRes.cookies.length > 0 || baseRes.headers.size > 0)) {
      c.res = applyCollectingResponse(baseRes, c.res)
    }
  })
}

/**
 * Middleware that verifies the caller has a valid SuperTokens session.
 *
 * On success the `SessionContainer` is stored in the context and accessible
 * via `c.get('session')` or `getSession(c)`.
 *
 * On failure a `401 Unauthorized` JSON response is returned automatically.
 *
 * @example
 * ```ts
 * // Require a session
 * app.get('/me', verifySession(), (c) => {
 *   const session = c.get('session')
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
    // Lazy-import so callers only pay for Session if they actually use this
    const Session = (await import('supertokens-node/recipe/session')).default

    const baseReq = await buildPreParsedRequest(c)
    const baseRes = new CollectingResponse()

    try {
      const session = await Session.getSession(baseReq, baseRes, options)

      if (session !== undefined) {
        c.set('session', session)
      }

      await next()

      // Propagate cookie updates written during session verification
      if (c.res && (baseRes.cookies.length > 0 || baseRes.headers.size > 0)) {
        c.res = applyCollectingResponse(baseRes, c.res)
      }
    } catch (err: unknown) {
      if (Session.Error.isErrorFromSuperTokens(err as Error)) {
        const e = err as { type: string }
        const isTryRefresh = e.type === Session.Error.TRY_REFRESH_TOKEN
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
  if (!session) {
    throw new Error(
      '[hono-supertokens] No session found in context. Make sure verifySession() middleware has run.'
    )
  }
  return session
}
