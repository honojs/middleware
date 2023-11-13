import { HTTPException } from 'hono/http-exception'

import type { GithubErrorResponse, GithubTokenResponse, GithubUser, GithubScope, Token } from './types'
import { toQueryParams } from './utils/toQueryParams'

type GithubAuthFlow = {
  client_id: string
  client_secret: string
  scope?: GithubScope[]
  oauthApp: boolean
  code: string | undefined
}

export class AuthFlow {
  client_id: string
  client_secret: string
  scope: GithubScope[] | undefined
  oauthApp: boolean
  code: string | undefined
  token: Token | undefined
  refresh_token: Token | undefined
  user: Partial<GithubUser> | undefined
  granted_scopes: string[] | undefined

  constructor({ client_id, client_secret, scope, oauthApp, code }: GithubAuthFlow) {
    this.client_id = client_id
    this.client_secret = client_secret
    this.scope = scope
    this.oauthApp = oauthApp
    this.code = code
    this.token = undefined
    this.refresh_token = undefined
    this.user = undefined
    this.granted_scopes = undefined
  }

  redirect() {
    const url = 'https://github.com/login/oauth/authorize?'

    if (this.oauthApp) {
      const parsedScope = toQueryParams({
        scope: this.scope
      })
      return `${url}${parsedScope}&client_id=${this.client_id}`
    }

    return `${url}client_id=${this.client_id}`
  }

  private resError(response: GithubErrorResponse) {
    if (response.error) throw new HTTPException(500, { message: response.error })
    if (response.message) throw new HTTPException(500, { message: response.message })
  }

  private async getTokenFromCode() {
    const response = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        body: JSON.stringify({
          client_id: this.client_id,
          client_secret: this.client_secret,
          code: this.code
        }),
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      }
    )
      .then(res => res.json()) as GithubTokenResponse

    this.resError(response)

    this.token = {
      token: response.access_token,
      expires_in: response.expires_in
    }
    this.refresh_token = {
      token: response.refresh_token,
      expires_in: response.refresh_token_expires_in
    }

    this.granted_scopes = response.scope.split(',')
  }

  async getUserData() {
    if (!this.token?.token) await this.getTokenFromCode()

    const response = await fetch(
      'https://api.github.com/user',
      {
        headers: {
          Authorization: `Bearer ${this.token?.token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'Hono-Auth-App',
        }
      }
    )
      .then(res => res.json()) as GithubUser

    this.resError(response)

    this.user = response
  }
}