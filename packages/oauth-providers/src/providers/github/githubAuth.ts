import type { MiddlewareHandler } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import { env } from 'hono/adapter'
import { HTTPException } from 'hono/http-exception'

import { getRandomState } from '../../utils/getRandomState'
import { AuthFlow } from './authFlow'
import type { GitHubScope } from './types'

export function githubAuth(options: {
  client_id?: string
  client_secret?: string
  scope?: GitHubScope[]
  oauthApp?: boolean
}): MiddlewareHandler {
  return async (c, next) => {
    const newState = getRandomState()
    // Create new Auth instance
    const auth = new AuthFlow({
      client_id: options.client_id || (env(c).GITHUB_ID as string),
      client_secret: options.client_secret || (env(c).GITHUB_SECRET as string),
      scope: options.scope,
      state: newState,
      oauthApp: options.oauthApp || false,
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

      // OAuth apps can't have multiple callback URLs, but GitHub Apps can.
      // As such, we want to make sure we call back to the same location
      // for GitHub apps and not the first configured callbackURL in the app config.
      return c.redirect(
        auth.redirect().concat(options.oauthApp ? '' : `&redirect_uri=${c.req.url}`)
      )
    }

    // Retrieve user data from github
    await auth.getUserData()

    // Set return info
    c.set('token', auth.token)
    c.set('refresh-token', auth.refresh_token)
    c.set('user-github', auth.user)
    c.set('granted-scopes', auth.granted_scopes)

    await next()
  }
}
