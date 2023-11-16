import { HTTPException } from 'hono/http-exception'

import { toQueryParams } from '../../utils/objectToQuery'
import type { GithubErrorResponse, GithubTokenResponse, GithubUser, GithubScope } from './types'

type GithubAuthFlow = {
  client_id: string
  client_secret: string
  scope?: GithubScope[]
  state: string
  oauthApp: boolean
  code: string | undefined
}
type Token = {
  token: string
  expires_in?: number
}
export class AuthFlow {
  client_id: string
  client_secret: string
  scope: GithubScope[] | undefined
  state: string
  oauthApp: boolean
  code: string | undefined
  token: Token | undefined
  refresh_token: Token | undefined
  user: Partial<GithubUser> | undefined
  granted_scopes: string[] | undefined

  constructor({ client_id, client_secret, scope, state, oauthApp, code }: GithubAuthFlow) {
    this.client_id = client_id
    this.client_secret = client_secret
    this.scope = scope
    this.state = state
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
        scope: this.scope,
        state: this.state
      })
      return `${url}${parsedScope}&client_id=${this.client_id}`
    }

    return `${url}client_id=${this.client_id}`
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
      .then(res => res.json()) as GithubTokenResponse | GithubErrorResponse

    if ('error_description' in response) throw new HTTPException(400, { message: response.error_description })

    if ('access_token' in response) {
      this.token = {
        token: response.access_token,
        expires_in: response.expires_in
      }
      this.granted_scopes = response.scope.split(',')

      if (response.refresh_token && response.refresh_token_expires_in) {
        this.refresh_token = {
          token: response.refresh_token,
          expires_in: response.refresh_token_expires_in
        }
      }
    }
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
      .then(res => res.json()) as GithubUser | GithubErrorResponse

    if ('message' in response) throw new HTTPException(400, { message: response.message })

    if ('id' in response) {
      this.user = response
    }
  }
}