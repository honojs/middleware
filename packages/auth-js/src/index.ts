import type { AuthConfig as AuthConfigCore } from '@auth/core'
import { Auth, createActionURL } from '@auth/core'
import type { AdapterUser } from '@auth/core/adapters'
import type { JWT } from '@auth/core/jwt'
import type { Session } from '@auth/core/types'
import type { Context, MiddlewareHandler } from 'hono'
import { env } from 'hono/adapter'
import { HTTPException } from 'hono/http-exception'
import { setEnvDefaults } from '@auth/core'

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

export async function getAuthUser(c: Context) {
  const ctxEnv = env(c)
  const config = c.get('authConfig')
  const req = c.req.raw

  const url = createActionURL('session', new URL(req.url).protocol, req.headers, ctxEnv, config)

  let authUser: AuthUser = {} as AuthUser

  const response = await Auth(
    new Request(url, { headers: { cookie: req.headers.get('cookie') ?? '' } }),
    {
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
    }
  )

  const session = (await response.json()) as Session | null

  return session?.user ? authUser : null
}

/**
 * A utility middleware to verify the session of the incoming request by getAuthUser under the hood.
 * If unauthorized, it will throw a 401 Unauthorized error.
 */
export function verifyAuth(): MiddlewareHandler {
  return async (c, next) => {
    const authUser = c.get('authUser') ?? (await getAuthUser(c))
    const isAuth = !!authUser?.token || !!authUser?.user
    if (!isAuth) throw new HTTPException(401, { message: 'Unauthorized' })
    c.set('authUser', authUser)
    await next()
  }
}

export function initAuthConfig(cb: ConfigHandler): MiddlewareHandler {
  return async (c, next) => {
    const config = cb(c)
    const ctxEnv = env(c) as AuthEnv
    setEnvDefaults(ctxEnv, config)
    c.set('authConfig', config)
    await next()
  }
}

export function authHandler(): MiddlewareHandler {
  return async (c) => {
    const config = c.get('authConfig')
    const res = await Auth(c.req.raw, config)
    return new Response(res.body, res)
  }
}
