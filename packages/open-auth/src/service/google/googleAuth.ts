import type { MiddlewareHandler } from 'hono'

import { HTTPException } from 'hono/http-exception'
import { AuthFlow } from './authFlow'

export function googleAuth(options: {
  scope: string[]
  response_type: 'code' | 'token'
  include_granted_scopes?: boolean
  login_hint?: string
  prompt?: 'none' | 'consent' | 'select_account'
  state?: string
  client_id?: string
  client_secret?: string
}): MiddlewareHandler {
  return async (c, next) => {
    // Create new Auth instance
    const auth = new AuthFlow({
      client_id: options.client_id || c.env?.GOOGLE_ID as string,
      client_secret: options.client_secret || c.env?.GOOGLE_SECRET as string,
      redirect_uri: c.req.url.split('?')[0],
      response_type: options.response_type,
      login_hint: options.login_hint,
      prompt: options.prompt,
      scope: options.scope,
      include_granted_scopes: options.include_granted_scopes,
      state: options.state,
      code: c.req.query('code'),
      token: {
        token: c.req.query('access_token') as string,
        expires_in: Number(c.req.query('expires-in')) as number
      }
    })

    // Avoid CSRF attack by checking state
    if (c.req.url.includes('?') && c.req.query('state') !== options.state) {
      throw new HTTPException(401, { message: 'Unauthorized, risk of CSRF attack.' })
    }

    // Redirect to login dialog
    if (auth.response_type === 'token' && !auth.token?.token) {
      return c.html(auth.redirect())
    } else if (auth.response_type === 'code' && !auth.code) {
      return c.redirect(auth.redirect())
    }

    // Retrieve user data from google
    await auth.getUserData()

    // Set return info
    c.set('token', auth.token)
    c.set('user-google', auth.user)
    c.set('granted-scopes', auth.granted_scopes)

    await next()
  }
}