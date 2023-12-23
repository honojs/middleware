import type { AuthConfig as AuthConfigCore } from '@auth/core'
import { Auth } from '@auth/core'
import type { AdapterUser } from '@auth/core/adapters'
import type { JWT } from '@auth/core/jwt'
import type { Session } from '@auth/core/types'
import type { Context, MiddlewareHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'

declare module 'hono' {
  interface ContextVariableMap {
    nextAuthUser: NextAuthUser
    nextAuthConfig: AuthConfig
  }
}

export type NextEnv = {
  AUTH_SECRET: string
  AUTH_URL: string
  AUTH_TRUST_HOST?: string
  AUTH_REDIRECT_PROXY_URL?: string
  [key: string]: string | undefined
}

export type NextAuthUser = {
  session: Session
  token?: JWT
  user?: AdapterUser
}

export interface AuthConfig extends Omit<AuthConfigCore, 'raw'> {
  authUrl?: string
}

export type ConfigHandler = (c: Context) => AuthConfig

function reqWithEnvUrl(req: Request, authUrl?: string): Request {
  return authUrl ? new Request(new URL(req.url, authUrl).href, req) : req
}

function detectOrigin(headers: Headers, authUrl?: string): URL {
  if (authUrl) return new URL(authUrl)

  const host = headers.get('x-forwarded-host') ?? headers.get('host')
  const protocol = headers.get('x-forwarded-proto') === 'http' ? 'http' : 'https'

  return new URL(`${protocol}://${host}`)
}

function setEnvDefaults(env: NextEnv, config: AuthConfig) {
  config.authUrl ??= env.AUTH_URL
  config.secret ??= env.AUTH_SECRET
  config.trustHost ??= !!(config.authUrl ?? env.AUTH_TRUST_HOST)
  config.redirectProxyUrl ??= env.AUTH_REDIRECT_PROXY_URL
  config.providers = config.providers.map((p) => {
    const finalProvider = typeof p === 'function' ? p({}) : p
    if (finalProvider.type === 'oauth' || finalProvider.type === 'oidc') {
      const ID = finalProvider.id.toUpperCase()
      finalProvider.clientId ??= env[`AUTH_${ID}_ID`]
      finalProvider.clientSecret ??= env[`AUTH_${ID}_SECRET`]
      if (finalProvider.type === 'oidc') {
        finalProvider.issuer ??= env[`AUTH_${ID}_ISSUER`]
      }
    }
    return finalProvider
  })
}

export async function getAuthUser(c: Context): Promise<NextAuthUser | null> {
  const config = c.get('nextAuthConfig')
  const headers = c.req.raw.headers
  const origin = detectOrigin(headers, config.authUrl)
  const request = new Request(`${origin}/session`, {
    headers: { cookie: headers.get('cookie') ?? '' },
  })

  setEnvDefaults(c.env, config)

  let authUser: NextAuthUser = {} as NextAuthUser

  const response = (await Auth(request, {
    ...config,
    callbacks: {
      ...config.callbacks,
      async session(...args) {
        authUser = args[0]
        const session = (await config.callbacks?.session?.(...args)) ?? args[0].session
        // @ts-expect-error either user or token will be defined
         const user = args[0].user ?? args[0].token
        return { user, ...session } satisfies Session
      },
    },
  })) as Response

  const session = (await response.json()) as Session | null

  return session && session.user ? authUser : null
}

export function verifyAuth(): MiddlewareHandler {
  return async (c, next) => {
    const authUser = await getAuthUser(c)
    const isAuth = (!!authUser?.token) || (!!authUser?.user)
    if (!isAuth) {
      const res = new Response('Unauthorized', {
        status: 401,
      })
      throw new HTTPException(401, { res })
    } else c.set('nextAuthUser', authUser)

    await next()
  }
}

export function initAuthConfig(cb: ConfigHandler): MiddlewareHandler {
  return async (c, next) => {
    const config = cb(c)
    c.set('nextAuthConfig', config)
    await next()
  }
}

export function authHandler(): MiddlewareHandler {
  return async (c) => {
    const config = c.get('nextAuthConfig')

    setEnvDefaults(c.env, config)

    if (!config.authUrl) {
      throw new Error('Missing AUTH_URL')
    }

    if (!config.secret) {
      throw new Error('Missing AUTH_SECRET')
    }

    const res = await Auth(reqWithEnvUrl(c.req.raw, config.authUrl), config)
    return new Response(res.body, res)
  }
}
