import { HTTPException } from 'hono/http-exception'

import type { Token } from '../../types'
import { toQueryParams } from '../../utils/objectToQuery'
import type {
  LinkedInErrorResponse,
  LinkedInScope,
  LinkedInTokenResponse,
  LinkedInUser,
} from './types'

export type LinkedInAuthFlow = {
  client_id: string
  client_secret: string
  redirect_uri: string
  scope: LinkedInScope[] | undefined
  state: string
  appAuth: boolean
  code: string | undefined
}

export class AuthFlow {
  client_id: string
  client_secret: string
  redirect_uri: string
  scope: LinkedInScope[] | undefined
  state: string
  code: string | undefined
  token: Token | undefined
  refresh_token: Token | undefined
  user: Partial<LinkedInUser> | undefined
  granted_scopes: string[] | undefined

  constructor({
    client_id,
    client_secret,
    redirect_uri,
    scope,
    state,
    appAuth,
    code,
  }: LinkedInAuthFlow) {
    this.client_id = client_id
    this.client_secret = client_secret
    ;(this.redirect_uri = redirect_uri), (this.scope = scope)
    this.state = state
    this.code = appAuth ? '' : code
    this.token = undefined
    this.refresh_token = undefined
    this.user = undefined
    this.granted_scopes = undefined
  }

  redirect() {
    const params = toQueryParams({
      response_type: 'code',
      client_id: this.client_id,
      redirect_uri: this.redirect_uri,
      scope: this.scope?.join(' ') || undefined,
      state: this.state,
    })

    return `https://www.linkedin.com/oauth/v2/authorization?${params}`
  }

  private async getTokenFromCode() {
    const params = toQueryParams({
      grant_type: 'authorization_code',
      code: this.code,
      client_id: this.client_id,
      client_secret: this.client_secret,
      redirect_uri: this.redirect_uri,
    })

    const response = (await fetch(`https://www.linkedin.com/oauth/v2/accessToken?${params}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }).then((res) => res.json())) as LinkedInTokenResponse | LinkedInErrorResponse

    if ('error' in response) {
      throw new HTTPException(400, { message: response.error_description })
    }

    if ('access_token' in response) {
      this.token = {
        token: response.access_token,
        expires_in: response.expires_in,
      }
      this.refresh_token = {
        token: response.refresh_token,
        expires_in: response.refresh_token_expires_in,
      }

      this.granted_scopes = response.scope?.split(',')
    }
  }

  async getUserData(): Promise<void> {
    if (!this.token) {
      await this.getTokenFromCode()
    }

    const response = (await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${this.token?.token}`,
      },
    }).then((res) => res.json())) as LinkedInUser | LinkedInErrorResponse

    if ('message' in response) {
      throw new HTTPException(400, { message: response.message })
    }

    if ('sub' in response) {
      this.user = response
    }
  }

  async getAppToken(): Promise<void> {
    const params = toQueryParams({
      grant_type: 'client_credentials',
      client_id: this.client_id,
      client_secret: this.client_secret,
    })

    const response = (await fetch(`https://www.linkedin.com/oauth/v2/accessToken?${params}`).then(
      (res) => res.json()
    )) as LinkedInTokenResponse | LinkedInErrorResponse

    if ('error' in response) {
      throw new HTTPException(400, { message: response.error_description })
    }

    if ('access_token' in response) {
      this.token = {
        token: response.access_token,
        expires_in: response.expires_in,
      }

      this.granted_scopes = response.scope?.split(',')
    }
  }
}
