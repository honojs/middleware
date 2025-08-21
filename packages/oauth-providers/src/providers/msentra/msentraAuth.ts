import type { MiddlewareHandler } from 'hono'
import { env } from 'hono/adapter'
import { getCookie, setCookie } from 'hono/cookie'
import { HTTPException } from 'hono/http-exception'

import { getRandomState } from '../../utils/getRandomState'
import { AuthFlow } from './authFlow'

export function msentraAuth(options: {
  client_id?: string
  client_secret?: string
  tenant_id?: string
  redirect_uri?: string
  code?: string | undefined
  scope: string[]
  state?: string
}): MiddlewareHandler {
  return async (c, next) => {
    // Generate encoded "keys" if not provided
    const newState = options.state || getRandomState()
    // Create new Auth instance
    const auth = new AuthFlow({
      client_id: options.client_id || (env(c).MSENTRA_ID as string),
      client_secret: options.client_secret || (env(c).MSENTRA_SECRET as string),
      tenant_id: options.tenant_id || (env(c).MSENTRA_TENANT_ID as string),
      redirect_uri: options.redirect_uri || c.req.url.split('?')[0],
      code: c.req.query('code'),
      token: {
        token: c.req.query('access_token') as string,
        expires_in: Number(c.req.query('expires_in')) as number,
      },
      scope: options.scope,
      state: newState,
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

    // Retrieve user data from Microsoft Entra
    await auth.getUserData()

    // Set return info
    c.set('token', auth.token)
    c.set('user-msentra', auth.user)
    c.set('granted-scopes', auth.granted_scopes)

    await next()
  }
}
