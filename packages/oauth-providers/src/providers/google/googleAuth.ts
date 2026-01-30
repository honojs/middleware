import type { MiddlewareHandler } from 'hono'
import { env } from 'hono/adapter'
import { getCookie, setCookie } from 'hono/cookie'
import { HTTPException } from 'hono/http-exception'

import { getRandomState } from '../../utils/getRandomState'
import { AuthFlow } from './authFlow'

export function googleAuth(options: {
  scope: string[]
  login_hint?: string
  prompt?: 'none' | 'consent' | 'select_account'
  access_type?: 'online' | 'offline'
  client_id?: string
  client_secret?: string
  state?: string
  redirect_uri?: string
}): MiddlewareHandler {
  return async (c, next) => {
    const newState = options.state || getRandomState()
    // Create new Auth instance
    const auth = new AuthFlow({
      client_id: options.client_id || (env(c).GOOGLE_ID as string),
      client_secret: options.client_secret || (env(c).GOOGLE_SECRET as string),
      redirect_uri: options.redirect_uri || c.req.url.split('?')[0],
      login_hint: options.login_hint,
      prompt: options.prompt,
      access_type: options.access_type,
      // profile scope is always mandatory because https://www.googleapis.com/oauth2/v2/userinfo needs it
      scope: options.includes("profile") ? options.scope : ["profile", ...options.scope],
      state: newState,
      code: c.req.query('code'),
      token: {
        token: c.req.query('access_token') as string,
        expires_in: Number(c.req.query('expires-in')) as number,
      },
    })

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

    // Avoid CSRF attack by checking state
    if (c.req.url.includes('?')) {
      const storedState = getCookie(c, 'state')
      if (c.req.query('state') !== storedState) {
        throw new HTTPException(401)
      }
    }

    // Retrieve user data from google
    await auth.getUserData()

    // Set return info
    c.set('token', auth.token)
    c.set('user-google', auth.user)
    c.set('granted-scopes', auth.granted_scopes)
    c.set('refresh-token', auth.refresh_token)

    await next()
  }
}
