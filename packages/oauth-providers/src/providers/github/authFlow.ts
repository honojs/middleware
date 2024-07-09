import { HTTPException } from 'hono/http-exception'

import { toQueryParams } from '../../utils/objectToQuery'
import type {
  GitHubErrorResponse,
  GitHubTokenResponse,
  GitHubUser,
  GitHubScope,
  GitHubEmailResponse,
} from './types'

type GithubAuthFlow = {
  client_id: string
  client_secret: string
  scope?: GitHubScope[]
  state: string
  oauthApp: boolean
  code: string | undefined
}
type Token = {
  token: string
  expires_in?: number
}

const userAgent = 'Hono-Auth-App'

export class AuthFlow {
  client_id: string
  client_secret: string
  scope: GitHubScope[] | undefined
  state: string
  oauthApp: boolean
  code: string | undefined
  token: Token | undefined
  refresh_token: Token | undefined
  user: Partial<GitHubUser> | undefined
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

    const queryParams = toQueryParams({
      client_id: this.client_id,
      state: this.state,
      // For GitHub apps, the scope is configured during the app setup / creation.
      // For OAuth apps, we need to provide the scope.
      ...(this.oauthApp && { scope: this.scope }),
    })

    return url.concat(queryParams)
  }

  private async getTokenFromCode() {
    const response = (await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      body: JSON.stringify({
        client_id: this.client_id,
        client_secret: this.client_secret,
        code: this.code,
      }),
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    }).then((res) => res.json())) as GitHubTokenResponse | GitHubErrorResponse

    if ('error_description' in response) {
      throw new HTTPException(400, { message: response.error_description })
    }

    if ('access_token' in response) {
      this.token = {
        token: response.access_token,
        expires_in: response.expires_in,
      }
      this.granted_scopes = response.scope.split(',')

      if (response.refresh_token && response.refresh_token_expires_in) {
        this.refresh_token = {
          token: response.refresh_token,
          expires_in: response.refresh_token_expires_in,
        }
      }
    }
  }

  private async getEmail() {
    const emails = (await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `Bearer ${this.token?.token}`,
        'User-Agent': userAgent,
      },
    }).then((res) => res.json())) as GitHubEmailResponse[] | GitHubErrorResponse

    if ('message' in emails) {
      throw new HTTPException(400, { message: emails.message })
    }

    let email = emails.find((emails) => emails.primary === true)?.email
    if (email === undefined) {
      email = emails.find((emails) => !emails.email.includes('@users.noreply.github.com'))?.email
    }

    return email as string
  }

  async getUserData() {
    if (!this.token?.token) {
      await this.getTokenFromCode()
    }

    const response = (await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${this.token?.token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': userAgent,
      },
    }).then((res) => res.json())) as GitHubUser | GitHubErrorResponse

    if ('message' in response) {
      throw new HTTPException(400, { message: response.message })
    }

    response.email = await this.getEmail()

    if ('id' in response) {
      this.user = response
    }
  }
}
