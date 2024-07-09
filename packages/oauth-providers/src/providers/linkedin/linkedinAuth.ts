import type { MiddlewareHandler } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import { env } from 'hono/adapter'
import { HTTPException } from 'hono/http-exception'

import { getRandomState } from '../../utils/getRandomState'
import { AuthFlow } from './authFlow'
import type { LinkedInScope } from './types'

export function linkedinAuth(options: {
  client_id?: string
  client_secret?: string
  scope?: LinkedInScope[]
  appAuth?: boolean
}): MiddlewareHandler {
  return async (c, next) => {
    const newState = getRandomState()
    // Create new Auth instance
    const auth = new AuthFlow({
      client_id: options.client_id || (env(c).LINKEDIN_ID as string),
      client_secret: options.client_secret || (env(c).LINKEDIN_SECRET as string),
      redirect_uri: c.req.url.split('?')[0],
      scope: options.scope,
      state: newState,
      appAuth: options.appAuth || false,
      code: c.req.query('code'),
    })

    // Avoid CSRF attack by checking state
    if (c.req.url.includes('?')) {
      const storedState = getCookie(c, 'state')
      if (c.req.query('state') !== storedState) {
        throw new HTTPException(401)
      }
    }

    // Redirect to login dialog
    if (!auth.code && !options.appAuth) {
      setCookie(c, 'state', newState, {
        maxAge: 60 * 10,
        httpOnly: true,
        path: '/',
        // secure: true,
      })
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
