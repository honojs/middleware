import { HTTPException } from 'hono/http-exception'

import type { Token } from '../../types'
import { toQueryParams } from '../../utils/objectToQuery'
import type { XErrorResponse, XFields, XMeResponse, XScopes, XTokenResponse, XUser } from './types'

type XAuthFlow = {
  client_id: string
  client_secret: string
  redirect_uri: string
  scope: XScopes[]
  fields: XFields[] | undefined
  state: string
  codeVerifier: string
  codeChallenge: string
  code: string | undefined
}

export class AuthFlow {
  client_id: string
  client_secret: string
  redirect_uri: string
  code: string | undefined
  token: Token | undefined
  refresh_token: Token | undefined
  scope: string
  fields: XFields[] | undefined
  state: string | undefined
  code_verifier: string
  code_challenge: string
  authToken: string
  granted_scopes: string[] | undefined
  user: Partial<XUser> | undefined

  constructor({
    client_id,
    client_secret,
    redirect_uri,
    scope,
    fields,
    state,
    codeVerifier,
    codeChallenge,
    code,
  }: XAuthFlow) {
    if (
      client_id === undefined ||
      client_secret === undefined ||
      scope === undefined
    ) {
      throw new HTTPException(400, {
        message: 'Required parameters were not found. Please provide them to proceed.',
      })
    }

    this.client_id = client_id
    this.client_secret = client_secret
    this.redirect_uri = redirect_uri
    this.scope = scope.join(' ')
    this.fields = fields
    this.state = state
    this.code_verifier = codeVerifier
    this.code_challenge = codeChallenge
    this.authToken = btoa(`${encodeURIComponent(client_id)}:${encodeURIComponent(client_secret)}`)
    this.code = code
    this.token = undefined
    this.refresh_token = undefined
    this.granted_scopes = undefined
  }

  redirect() {
    const parsedOptions = toQueryParams({
      response_type: 'code',
      redirect_uri: this.redirect_uri,
      client_id: this.client_id,
      scope: this.scope,
      state: this.state,
      code_challenge: this.code_challenge,
      code_challenge_method: 'S256',
    })
    return `https://twitter.com/i/oauth2/authorize?${parsedOptions}`
  }

  private async getTokenFromCode() {
    const parsedOptions = toQueryParams({
      code: this.code,
      grant_type: 'authorization_code',
      client_id: this.client_id,
      redirect_uri: this.redirect_uri,
      code_verifier: this.code_verifier
    })
    const response = (await fetch(`https://api.twitter.com/2/oauth2/token?${parsedOptions}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${this.authToken}`
      }
    }).then((res) => res.json())) as XTokenResponse | XErrorResponse

    if ('error' in response) throw new HTTPException(400, { message: response.error_description })

    if ('access_token' in response) {
      this.token = {
        token: response.access_token,
        expires_in: response.expires_in,
      }

      this.granted_scopes = response.scope.split(' ')

      this.refresh_token = response.refresh_token ? { token: response.refresh_token, expires_in: 0 } : undefined
    }
  }

  async getUserData() {
    await this.getTokenFromCode()

    const parsedOptions = toQueryParams({
      'user.fields': this.fields
    })

    const response = (await fetch(`https://api.twitter.com/2/users/me?${parsedOptions}`, {
      headers: {
        authorization: `Bearer ${this.token?.token}`,
      },
    }).then((res) => res.json())) as XMeResponse | XErrorResponse

    
    if ('error_description' in response) throw new HTTPException(400, { message: response.error_description })
    
    if ('data' in response) this.user = response.data
  }
}