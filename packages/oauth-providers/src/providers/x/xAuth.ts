import type { MiddlewareHandler } from 'hono'
import { env } from 'hono/adapter'
import { getCookie, setCookie } from 'hono/cookie'
import { HTTPException } from 'hono/http-exception'

import { getCodeChallenge } from '../../utils/getCodeChallenge.ts'
import { getRandomState } from '../../utils/getRandomState.ts'
import { AuthFlow } from './authFlow.ts'
import type { XFields, XScopes } from './types.ts'

export function xAuth(options: {
  scope: XScopes[]
  fields?: XFields[]
  client_id?: string
  client_secret?: string
  redirect_uri?: string
}): MiddlewareHandler {
  return async (c, next) => {
    // Generate encoded "keys"
    const newState = getRandomState()
    const challenge = await getCodeChallenge()

    const auth = new AuthFlow({
      client_id: options.client_id || (env(c).X_ID as string),
      client_secret: options.client_secret || (env(c).X_SECRET as string),
      redirect_uri: options.redirect_uri || c.req.url.split('?')[0],
      scope: options.scope,
      fields: options.fields,
      state: newState,
      codeVerifier: getCookie(c, 'code-verifier') || challenge.codeVerifier,
      codeChallenge: challenge.codeChallenge,
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
    if (!auth.code) {
      setCookie(c, 'state', newState, {
        maxAge: 60 * 10,
        httpOnly: true,
        path: '/',
        // secure: true,
      })
      setCookie(c, 'code-verifier', challenge.codeVerifier, {
        maxAge: 60 * 10,
        httpOnly: true,
        path: '/',
        // secure: true,
      })
      return c.redirect(auth.redirect())
    }

    // Retrieve user data from x
    await auth.getUserData()

    // Set return info
    c.set('token', auth.token)
    c.set('refresh-token', auth.refresh_token)
    c.set('user-x', auth.user)
    c.set('granted-scopes', auth.granted_scopes)

    await next()
  }
}
