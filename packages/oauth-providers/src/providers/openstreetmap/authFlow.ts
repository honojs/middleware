import { HTTPException } from 'hono/http-exception'

import type { Token } from '../../types'
import { toQueryParams } from '../../utils/objectToQuery'
import type {
  OpenStreetMapErrorResponse,
  OpenStreetMapScope,
  OpenStreetMapTokenResponse,
  OpenStreetMapUser,
  OpenStreetMapUserResponse,
} from './types'

type OpenStreetMapAuthFlow = {
  client_id: string
  client_secret: string
  redirect_uri: string
  scope: OpenStreetMapScope[]
  state: string
  codeVerifier: string
  codeChallenge: string
  code: string | undefined
}

export class AuthFlow {
  client_id: string
  client_secret: string
  redirect_uri: string
  scope: string
  state: string
  code_verifier: string
  code_challenge: string
  code: string | undefined
  token: Token | undefined
  granted_scopes: string[] | undefined
  user: Partial<OpenStreetMapUser> | undefined

  constructor({
    client_id,
    client_secret,
    redirect_uri,
    scope,
    state,
    codeVerifier,
    codeChallenge,
    code,
  }: OpenStreetMapAuthFlow) {
    if (client_id === undefined || client_secret === undefined || scope === undefined) {
      throw new HTTPException(400, {
        message: 'Required parameters were not found. Please provide them to proceed.',
      })
    }

    this.client_id = client_id
    this.client_secret = client_secret
    this.redirect_uri = redirect_uri
    this.scope = scope.join(' ')
    this.state = state
    this.code_verifier = codeVerifier
    this.code_challenge = codeChallenge
    this.code = code
    this.token = undefined
    this.granted_scopes = undefined
    this.user = undefined
  }

  redirect(): string {
    const parsedOptions = toQueryParams({
      response_type: 'code',
      client_id: this.client_id,
      redirect_uri: this.redirect_uri,
      scope: this.scope,
      state: this.state,
      code_challenge: this.code_challenge,
      code_challenge_method: 'S256',
    })

    return `https://www.openstreetmap.org/oauth2/authorize?${parsedOptions}`
  }

  private async getTokenFromCode(): Promise<void> {
    const response = (await fetch('https://www.openstreetmap.org/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: toQueryParams({
        grant_type: 'authorization_code',
        code: this.code,
        redirect_uri: this.redirect_uri,
        client_id: this.client_id,
        client_secret: this.client_secret,
        code_verifier: this.code_verifier,
      }),
    }).then((res) => res.json())) as OpenStreetMapTokenResponse | OpenStreetMapErrorResponse

    if ('error' in response) {
      throw new HTTPException(400, { message: response.error_description })
    }

    if ('access_token' in response) {
      // OpenStreetMap access tokens do not expire, so there is no `expires_in`.
      this.token = {
        token: response.access_token,
      }
      this.granted_scopes = response.scope.split(' ')
    }
  }

  async getUserData(): Promise<void> {
    await this.getTokenFromCode()

    // The OpenStreetMap API replies to errors with a plain text body, so the
    // status has to be checked before parsing the response as JSON.
    const response = await fetch('https://api.openstreetmap.org/api/0.6/user/details.json', {
      headers: {
        Authorization: `Bearer ${this.token?.token}`,
      },
    })

    if (!response.ok) {
      const message = (await response.text()).trim()
      throw new HTTPException(400, { message: message || response.statusText })
    }

    const { user } = (await response.json()) as OpenStreetMapUserResponse

    this.user = user
  }
}
