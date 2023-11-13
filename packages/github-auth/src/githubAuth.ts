import type { MiddlewareHandler } from 'hono'

import { AuthFlow } from './authFlow'
import type { GithubScope } from './types'

export function githubAuth(options: {
  client_id?: string
  client_secret?: string
  scope?: GithubScope[]
  oauthApp?: boolean
}): MiddlewareHandler {
  return async (c, next) => {
    // Create new Auth instance
    const auth = new AuthFlow({
      client_id: options.client_id || c.env?.GITHUB_ID as string,
      client_secret: options.client_secret || c.env?.GITHUB_SECRET as string,
      scope: options.scope,
      oauthApp: options.oauthApp || false,
      code: c.req.query('code')
    })

    // Redirect to login dialog
    if (!c.req.query('code')) {
      return c.redirect(auth.redirect())
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