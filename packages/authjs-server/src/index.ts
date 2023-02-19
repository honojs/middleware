import { Auth } from '@auth/core'
import type { AuthAction, AuthConfig, Session } from '@auth/core/types'
import type { Context, MiddlewareHandler } from 'hono'

export interface HonoAuthConfig extends AuthConfig {
  /**
   * Defines the base path for the auth routes.
   * @default '/auth'
   */
  prefix?: string
}

const actions: AuthAction[] = [
  'providers',
  'session',
  'csrf',
  'signin',
  'signout',
  'callback',
  'verify-request',
  'error',
]

function HonoAuthHandler(prefix: string, authOptions: HonoAuthConfig) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return async (c: Context) => {
    const { req } = c
    const url = new URL(req.url)
    const action = url.pathname.slice(prefix.length + 1).split('/')[0] as AuthAction

    if (!actions.includes(action) || !url.pathname.startsWith(prefix + '/')) {
      return
    }

    return await Auth(req.raw, authOptions)
  }
}

export const authjsServer = (config: HonoAuthConfig): MiddlewareHandler => {
  const { prefix = '/auth', ...authOptions } = config
  authOptions.secret ??= process.env.AUTH_SECRET
  authOptions.trustHost ??= !!(
    process.env.AUTH_TRUST_HOST ??
    process.env.VERCEL ??
    process.env.NODE_ENV !== 'production'
  )
  return HonoAuthHandler(prefix, authOptions)
}

export type GetSessionResult = Promise<Session | null>

export async function getSession(req: Request, options: AuthConfig): GetSessionResult {
  options.secret ??= process.env.AUTH_SECRET
  options.trustHost ??= true

  const url = new URL('/auth/session', req.url)
  const response = await Auth(new Request(url, { headers: req.headers }), options)

  const { status = 200 } = response

  const data = await response.json()

  if (!data || !Object.keys(data).length) return null
  if (status === 200) return data as Session
  const error = data as { message?: string }
  throw new Error(error?.message)
}
