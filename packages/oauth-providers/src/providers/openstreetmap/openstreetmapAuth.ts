import type { MiddlewareHandler } from 'hono'
import { env } from 'hono/adapter'
import { getCookie, setCookie } from 'hono/cookie'
import { HTTPException } from 'hono/http-exception'

import { getCodeChallenge } from '../../utils/getCodeChallenge'
import { getRandomState } from '../../utils/getRandomState'
import { AuthFlow } from './authFlow'
import type { OpenStreetMapScope } from './types'

export function openstreetmapAuth(options: {
  scope: OpenStreetMapScope[]
  client_id?: string
  client_secret?: string
  state?: string
  redirect_uri?: string
}): MiddlewareHandler {
  return async (c, next) => {
    const newState = options.state ?? getRandomState()
    const challenge = await getCodeChallenge()
    const { OPENSTREETMAP_ID, OPENSTREETMAP_SECRET } = env<{
      OPENSTREETMAP_ID?: string
      OPENSTREETMAP_SECRET?: string
    }>(c)

    // Create new Auth instance
    const auth = new AuthFlow({
      client_id: options.client_id ?? (OPENSTREETMAP_ID as string),
      client_secret: options.client_secret ?? (OPENSTREETMAP_SECRET as string),
      redirect_uri: options.redirect_uri ?? c.req.url.split('?')[0],
      scope: options.scope,
      state: newState,
      codeVerifier: getCookie(c, 'code-verifier') ?? challenge.codeVerifier,
      codeChallenge: challenge.codeChallenge,
      code: c.req.query('code'),
    })

    // Redirect to login dialog
    if (!auth.code) {
      setCookie(c, 'state', newState, {
        maxAge: 60 * 10,
        httpOnly: true,
        path: '/',
        secure: true,
        sameSite: 'Lax',
      })
      setCookie(c, 'code-verifier', challenge.codeVerifier, {
        maxAge: 60 * 10,
        httpOnly: true,
        path: '/',
        secure: true,
        sameSite: 'Lax',
      })
      return c.redirect(auth.redirect())
    }

    // Avoid CSRF attack by checking state
    const storedState = getCookie(c, 'state')
    const state = c.req.query('state')
    if (!storedState || !state || state !== storedState) {
      throw new HTTPException(401)
    }

    // Retrieve user data from OpenStreetMap
    await auth.getUserData()

    // Set return info
    c.set('token', auth.token)
    c.set('user-openstreetmap', auth.user)
    c.set('granted-scopes', auth.granted_scopes)

    await next()
  }
}
