import type { MiddlewareHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'

import { AuthFlow } from './authFlow'
import type { LinkedInScope } from './types'

export function linkedInAuth(options: {
  client_id?: string
  client_secret?: string
  scope?: LinkedInScope[]
  state?: string
  appAuth?: boolean
}): MiddlewareHandler {
  return async (c, next) => {
    const auth = new AuthFlow({
      client_id: options.client_id || c.env?.LINKEDIN_ID as string,
      client_secret: options.client_secret || c.env?.LINKEDIN_SECRET as string,
      redirect_uri: c.req.url.split('?')[0],
      scope: options.scope,
      state: options.state || undefined,
      code: c.req.query('code')
    })

    // Avoid CSRF attack by checking state
    if (c.req.url.includes('?') && c.req.query('state') !== options.state) {
      throw new HTTPException(401, { message: 'Unauthorized' })
    }

    // Check for cancel' actions
    if (c.req.query('error')) {
      c.set('cancelled', { error: c.req.query('error'), description: c.req.query('error_description') })
    }

    // Redirect to login dialog
    if (!c.req.query('code') && !options.appAuth) {
      return c.redirect(auth.redirect())
    }

    if (options.appAuth) {
      await auth.getAppToken()
    } else {
      await auth.getUserData()
    }

    // Set return info
    c.set('token', auth.token)
    c.set('refresh-token', auth.refresh_token)
    c.set('user-linkedin', auth.user)
    c.set('granted-scopes', auth.granted_scopes)

    await next()
  }
}