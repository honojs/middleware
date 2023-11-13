import type { MiddlewareHandler } from 'hono'
import { html } from 'hono/html'
import { HTTPException } from 'hono/http-exception'

import { AuthFlow } from './authFlow'
import type { FacebookResponseType, Fields, Permissions } from './types'

export function facebookAuth(options: {
  scope: Permissions[]
  response_type: FacebookResponseType[]
  include_granted_scopes?: boolean
  fields: Fields[]
  state?: string
  client_id?: string
  client_secret?: string
}): MiddlewareHandler {
  return async (c, next) => {
    // Create new Auth instance
    const auth = new AuthFlow({
      client_id: options.client_id || c.env?.FACEBOOK_ID as string,
      client_secret: options.client_secret || c.env?.FACEBOOK_SECRET as string,
      redirect_uri: c.req.url.split('?')[0],
      response_type: options.response_type,
      scope: options.scope,
      include_granted_scopes: options.include_granted_scopes || false,
      fields: options.fields,
      state: options.state,
      code: c.req.query('code'),
      token: {
        token: c.req.query('access_token') as string,
        expires_in: Number(c.req.query('expires_in'))
      }
    })

    // Avoid CSRF attack by checking state
    if (c.req.url.includes('?') && c.req.query('state') !== options.state) {
      throw new HTTPException(401, { message: 'Unauthorized, risk of CSRF attack.' })
    }

    // Clean token url response
    if (
      (auth.response_type.includes('token') || auth.response_type.includes('code%20token'))
      && !auth.token?.token && c.req.url.includes('?')
    ) {
      return c.html(html`
        <html>
          <head>
            <script>
              const url = window.location.href.replace('#', '')
              window.location.href = url
            </script>
          </head>
        </html>
      `)
    }

    // Redirect to login dialog
    if (
      (auth.response_type.includes('code') && !auth.code) ||
      (auth.response_type.includes('token') && !auth.token?.token) ||
      (auth.response_type.includes('code%20token') && !auth.code && !auth.token?.token)
    ) {
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