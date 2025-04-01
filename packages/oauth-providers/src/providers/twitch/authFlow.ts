import { HTTPException } from 'hono/http-exception'

import type { Token } from '../../types'
import { toQueryParams } from '../../utils/objectToQuery'
import type {
  TwitchErrorResponse,
  TwitchUserResponse,
  TwitchTokenResponse,
  TwitchUser,
  Scopes,
} from './types'

type TwitchAuthFlow = {
  client_id: string
  client_secret: string
  redirect_uri: string
  scope: Scopes[]
  state: string
  code: string | undefined
  force_verify: boolean | undefined
}

export class AuthFlow {
  client_id: string
  client_secret: string
  redirect_uri: string
  scope: string
  state: string
  code: string | undefined
  token: Token | undefined
  refresh_token: Token | undefined
  granted_scopes: string[] | undefined
  user: Partial<TwitchUser> | undefined
  force_verify: boolean | undefined

  constructor({
    client_id,
    client_secret,
    redirect_uri,
    scope,
    state,
    code,
    force_verify,
  }: TwitchAuthFlow) {
    this.client_id = client_id
    this.client_secret = client_secret
    this.redirect_uri = redirect_uri
    this.scope = scope.join(' ')
    this.state = state
    this.code = code
    this.refresh_token = undefined
    this.force_verify = force_verify
    this.granted_scopes = undefined
    this.user = undefined
  }

  redirect() {
    const parsedOptions = toQueryParams({
      client_id: this.client_id,
      force_verify: this.force_verify,
      redirect_uri: this.redirect_uri,
      response_type: 'code',
      scope: this.scope,
      state: this.state,
    })
    return `https://id.twitch.tv/oauth2/authorize?${parsedOptions}`
  }

  private async getTokenFromCode() {
    const parsedOptions = toQueryParams({
      client_id: this.client_id,
      client_secret: this.client_secret,
      code: this.code,
      grant_type: 'authorization_code',
      redirect_uri: this.redirect_uri,
    })

    const url = 'https://id.twitch.tv/oauth2/token'

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: parsedOptions,
    }).then((res) => res.json() as Promise<TwitchTokenResponse>)

    if ('error' in response) {
      throw new HTTPException(400, { message: response.error })
    }

    if ('access_token' in response) {
      this.token = {
        token: response.access_token,
        expires_in: response.expires_in,
      }
    }

    if ('refresh_token' in response) {
      this.refresh_token = {
        token: response.refresh_token,
        expires_in: 0,
      }
    }

    if ('scope' in response) {
      this.granted_scopes = response.scope
    }
  }

  async getUserData() {
    await this.getTokenFromCode()
    const response = (await fetch('https://api.twitch.tv/helix/users', {
      headers: {
        authorization: `Bearer ${this.token?.token}`,
        'Client-ID': this.client_id,
      },
    }).then((res) => res.json())) as TwitchUserResponse | TwitchErrorResponse

    if ('error' in response) {
      throw new HTTPException(400, { message: JSON.stringify(response) })
    }
    if ('message' in response) {
      throw new HTTPException(400, { message: JSON.stringify(response) })
    }

    if ('data' in response) {
      this.user = response.data[0]
    }
  }
}
