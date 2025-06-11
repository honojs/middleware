import type { MiddlewareHandler } from 'hono'
import { env } from 'hono/adapter'
import { getCookie, setCookie } from 'hono/cookie'
import { HTTPException } from 'hono/http-exception'

import { getRandomState } from '../../utils/getRandomState.ts'
import { AuthFlow } from './authFlow.ts'
import type { Scopes } from './types.ts'

export function twitchAuth(options: {
  scope: Scopes[]
  client_id: string
  client_secret: string
  redirect_uri?: string
  state?: string
  force_verify?: boolean
}): MiddlewareHandler {
  return async (c, next) => {
    // Generate encoded "keys" if not provided
    const newState = options.state || getRandomState()
    // Create new Auth instance
    const auth = new AuthFlow({
      client_id: options.client_id || (env(c).TWITCH_ID as string),
      client_secret: options.client_secret || (env(c).TWITCH_SECRET as string),
      redirect_uri: options.redirect_uri || c.req.url.split('?')[0],
      scope: options.scope,
      state: newState,
      code: c.req.query('code'),
      force_verify: options.force_verify || false,
    })

    // Redirect to login dialog
    if (!auth.code) {
      setCookie(c, 'state', newState, {
        maxAge: 60 * 10,
        httpOnly: true,
        path: '/',
      })
      return c.redirect(auth.redirect())
    }

    // Avoid CSRF attack by checking state
    if (c.req.url.includes('?')) {
      const storedState = getCookie(c, 'state')
      if (c.req.query('state') !== storedState) {
        throw new HTTPException(401)
      }
    }

    // Retrieve user data from twitch
    await auth.getUserData()

    // Set return info
    c.set('token', auth.token)
    c.set('refresh-token', auth.refresh_token)
    c.set('user-twitch', auth.user)
    c.set('granted-scopes', auth.granted_scopes)

    await next()
  }
}
