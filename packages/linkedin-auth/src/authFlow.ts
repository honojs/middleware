import { HTTPException } from 'hono/http-exception'

import type { LinkedInErrorResponse, LinkedInTokenResponse, LinkedInUser, LinkedInScope, Token } from './types'
import { toQueryParams } from './utils/toQueryParams'

export type LinkedInAuthFlow = {
  client_id: string
  client_secret: string
  redirect_uri: string
  scope: LinkedInScope[] | undefined
  state?: string
  code: string | undefined
}

export class AuthFlow {
  client_id: string
  client_secret: string
  redirect_uri: string
  scope: LinkedInScope[] | undefined
  state: string | undefined
  code: string | undefined
  token: Token | undefined
  refresh_token: Token | undefined
  user: Partial<LinkedInUser> | undefined
  granted_scopes: string[] | undefined

  constructor({ client_id, client_secret, redirect_uri, scope, state, code }: LinkedInAuthFlow) {
    this.client_id = client_id
    this.client_secret = client_secret
    this.redirect_uri = redirect_uri,
    this.state = state
    this.scope = scope
    this.code = code
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

  private resError(response: LinkedInErrorResponse) {
    if (response.error) throw new HTTPException(500, { message: response.error })
  }

  private async getTokenFromCode() {
    const params = toQueryParams({
      grant_type: 'authorization_code',
      code: this.code,
      client_id: this.client_id,
      client_secret: this.client_secret,
      redirect_uri: this.redirect_uri
    })

    const response = await fetch(
      `https://www.linkedin.com/oauth/v2/accessToken?${params}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        }
      }
    )
      .then(res => res.json()) as LinkedInTokenResponse

    this.resError(response)

    this.token = {
      token: response.access_token,
      expires_in: response.expires_in
    }
    this.refresh_token = {
      token: response.refresh_token,
      expires_in: response.refresh_token_expires_in
    }

    this.granted_scopes = response.scope?.split(',')
  }

  async getUserData() {
    if (!this.token) {
      await this.getTokenFromCode()
    }

    const response = await fetch(
      'https://api.linkedin.com/v2/userinfo',
      {
        headers: {
          Authorization: `Bearer ${this.token?.token}`,
        }
      }
    )
      .then(res => res.json()) as LinkedInUser

    this.resError(response)

    this.user = response
  }

  async getAppToken() {
    const params = toQueryParams({
      grant_type: 'client_credentials',
      client_id: this.client_id,
      client_secret: this.client_secret
    })
    
    const response = await fetch(`https://www.linkedin.com/oauth/v2/accessToken?${params}`)
      .then(res => res.json()) as LinkedInTokenResponse

    this.resError(response)

    this.token = {
      token: response.access_token,
      expires_in: response.expires_in
    }

    this.granted_scopes = response.scope?.split(',')
  }
}