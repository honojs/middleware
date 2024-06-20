import type { MiddlewareHandler } from 'hono'
import { setCookie, getCookie } from 'hono/cookie'
import { env } from 'hono/adapter'
import { HTTPException } from 'hono/http-exception'

import { getRandomState } from '../../utils/getRandomState'
import { AuthFlow } from './authFlow'
import type { Scopes } from './types'

export function discordAuth(options: {
  scope: Scopes[]
  client_id?: string
  client_secret?: string
}): MiddlewareHandler {
  return async (c, next) => {
    // Generate encoded "keys"
    const newState = getRandomState()

    // Create new Auth instance
    const auth = new AuthFlow({
      client_id: options.client_id || (env(c).DISCORD_ID as string),
      client_secret: options.client_secret || (env(c).DISCORD_SECRET as string),
      redirect_uri: c.req.url.split('?')[0],
      scope: options.scope,
      state: newState,
      code: c.req.query('code'),
      token: {
        token: c.req.query('access_token') as string,
        expires_in: Number(c.req.query('expires_in')),
      },
    })

    // Avoid CSRF attack by checking state
    if (c.req.url.includes('?')) {
      const storedState = getCookie(c, 'state')
      if (c.req.query('state') !== storedState) {
        throw new HTTPException(401)
      }
    }

    // Redirect to login dialog
    if (!auth.code) {
      setCookie(c, 'state', newState, {
        maxAge: 60 * 10,
        httpOnly: true,
        path: '/',
        // secure: true,
      })
      return c.redirect(auth.redirect())
    }

    // Retrieve user data from discord
    await auth.getUserData()

    // Set return info
    c.set('token', auth.token)
    c.set('refresh-token', auth.refresh_token)
    c.set('user-discord', auth.user)
    c.set('granted-scopes', auth.granted_scopes)

    await next()
  }
}
