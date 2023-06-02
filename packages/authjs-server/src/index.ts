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
  return HonoAuthHandler(prefix, authOptions)
}
