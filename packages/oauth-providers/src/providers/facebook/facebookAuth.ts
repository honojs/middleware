import type { MiddlewareHandler } from 'hono'
import { setCookie, getCookie } from 'hono/cookie'
import { env } from 'hono/adapter'
import { HTTPException } from 'hono/http-exception'

import { getRandomState } from '../../utils/getRandomState'
import { AuthFlow } from './authFlow'
import type { Fields, Permissions } from './types'

export function facebookAuth(options: {
  scope: Permissions[]
  fields: Fields[]
  client_id?: string
  client_secret?: string
}): MiddlewareHandler {
  return async (c, next) => {
    const newState = getRandomState()
    // Create new Auth instance
    const auth = new AuthFlow({
      client_id: options.client_id || (env(c).FACEBOOK_ID as string),
      client_secret: options.client_secret || (env(c).FACEBOOK_SECRET as string),
      redirect_uri: c.req.url.split('?')[0],
      scope: options.scope,
      fields: options.fields,
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

    // Retrieve user data from facebook
    await auth.getUserData()

    // Set return info
    c.set('token', auth.token)
    c.set('user-facebook', auth.user)
    c.set('granted-scopes', c.req.query('granted_scopes')?.split(','))

    await next()
  }
}
