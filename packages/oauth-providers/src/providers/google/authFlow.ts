import { HTTPException } from 'hono/http-exception'

import type { Token } from '../../types'
import { toQueryParams } from '../../utils/objectToQuery'
import type { GoogleErrorResponse, GoogleTokenResponse, GoogleUser } from './types'

type GoogleAuthFlow = {
  client_id: string
  client_secret: string
  redirect_uri: string
  code: string | undefined
  token: Token | undefined
  scope: string[]
  state?: string
  login_hint?: string
  prompt?: 'none' | 'consent' | 'select_account'
}

export class AuthFlow {
  client_id: string
  client_secret: string
  redirect_uri: string
  code: string | undefined
  token: Token | undefined
  scope: string[]
  state: string | undefined
  login_hint: string | undefined
  prompt: 'none' | 'consent' | 'select_account' | undefined
  user: Partial<GoogleUser> | undefined
  granted_scopes: string[] | undefined

  constructor({
    client_id,
    client_secret,
    redirect_uri,
    login_hint,
    prompt,
    scope,
    state,
    code,
    token,
  }: GoogleAuthFlow) {
    this.client_id = client_id
    this.client_secret = client_secret
    this.redirect_uri = redirect_uri
    this.login_hint = login_hint
    this.prompt = prompt
    this.scope = scope
    this.state = state
    this.code = code
    this.token = token
    this.user = undefined
    this.granted_scopes = undefined

    if (
      this.client_id === undefined ||
      this.client_secret === undefined ||
      this.scope === undefined
    ) {
      throw new HTTPException(400, {
        message: 'Required parameters were not found. Please provide them to proceed.',
      })
    }
  }

  redirect() {
    const parsedOptions = toQueryParams({
      response_type: 'code',
      redirect_uri: this.redirect_uri,
      client_id: this.client_id,
      include_granted_scopes: true,
      scope: this.scope.join(' '),
      state: this.state,
    })
    return `https://accounts.google.com/o/oauth2/v2/auth?${parsedOptions}`
  }

  async getTokenFromCode() {
    const response = (await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        clientId: this.client_id,
        clientSecret: this.client_secret,
        redirect_uri: this.redirect_uri,
        code: this.code,
        grant_type: 'authorization_code',
      }),
    }).then((res) => res.json())) as GoogleTokenResponse | GoogleErrorResponse

    if ('error' in response) {
      throw new HTTPException(400, { message: response.error_description })
    }

    if ('access_token' in response) {
      this.token = {
        token: response.access_token,
        expires_in: response.expires_in,
      }

      this.granted_scopes = response.scope.split(' ')
    }
  }

  async getUserData() {
    await this.getTokenFromCode()

    const response = (await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        authorization: `Bearer ${this.token?.token}`,
      },
    }).then((res) => res.json())) as GoogleUser | GoogleErrorResponse

    if ('error' in response) {
      throw new HTTPException(400, { message: response.error?.message })
    }

    if ('id' in response) {
      this.user = response
    }
  }
}
