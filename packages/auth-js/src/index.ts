import type { AuthConfig as AuthConfigCore } from '@auth/core'
import { Auth } from '@auth/core'
import type { AdapterUser } from '@auth/core/adapters'
import type { JWT } from '@auth/core/jwt'
import type { Session } from '@auth/core/types'
import type { Context, MiddlewareHandler } from 'hono'
import { env } from 'hono/adapter'
import { HTTPException } from 'hono/http-exception'

declare module 'hono' {
  interface ContextVariableMap {
    authUser: AuthUser
    authConfig: AuthConfig
  }
}

export type AuthEnv = {
  AUTH_URL?: string
  AUTH_SECRET: string
  AUTH_REDIRECT_PROXY_URL?: string
  [key: string]: string | undefined
}

export type AuthUser = {
  session: Session
  token?: JWT
  user?: AdapterUser
}

export interface AuthConfig extends Omit<AuthConfigCore, 'raw'> {}

export type ConfigHandler = (c: Context) => AuthConfig

export function reqWithEnvUrl(req: Request, authUrl?: string): Request {
  if (authUrl) {
    const reqUrlObj = new URL(req.url)
    const authUrlObj = new URL(authUrl)
    const props = ['hostname', 'protocol', 'port', 'password', 'username'] as const
    props.forEach((prop) => (reqUrlObj[prop] = authUrlObj[prop]))
    return new Request(reqUrlObj.href, req)
  } else {
    return req
  }
}

function setEnvDefaults(env: AuthEnv, config: AuthConfig) {
  config.secret ??= env.AUTH_SECRET
  config.basePath ??= '/api/auth'
  config.trustHost = true
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

export async function getAuthUser(c: Context): Promise<AuthUser | null> {
  const config = c.get('authConfig')
  let ctxEnv = env(c) as AuthEnv
  setEnvDefaults(ctxEnv, config)
  const origin = ctxEnv.AUTH_URL ? new URL(ctxEnv.AUTH_URL).origin : new URL(c.req.url).origin
  const request = new Request(`${origin}${config.basePath}/session`, {
    headers: { cookie: c.req.header('cookie') ?? '' },
  })

  let authUser: AuthUser = {} as AuthUser

  const response = (await Auth(request, {
    ...config,
    callbacks: {
      ...config.callbacks,
      async session(...args) {
        authUser = args[0]
        const session = (await config.callbacks?.session?.(...args)) ?? args[0].session
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
    const isAuth = !!authUser?.token || !!authUser?.user
    if (!isAuth) {
      const res = new Response('Unauthorized', {
        status: 401,
      })
      throw new HTTPException(401, { res })
    } else {
      c.set('authUser', authUser)
    }

    await next()
  }
}

export function initAuthConfig(cb: ConfigHandler): MiddlewareHandler {
  return async (c, next) => {
    const config = cb(c)
    c.set('authConfig', config)
    await next()
  }
}

export function authHandler(): MiddlewareHandler {
  return async (c) => {
    const config = c.get('authConfig')
    let ctxEnv = env(c) as AuthEnv

    setEnvDefaults(ctxEnv, config)

    if (!config.secret) {
      throw new HTTPException(500, { message: 'Missing AUTH_SECRET' })
    }

    const res = await Auth(reqWithEnvUrl(c.req.raw, ctxEnv.AUTH_URL), config)
    return new Response(res.body, res)
  }
}
