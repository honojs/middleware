import { HTTPException } from 'hono/http-exception'

import type { Token } from '../../types'
import { toQueryParams } from '../../utils/objectToQuery'
import type {
  DiscordErrorResponse,
  DiscordMeResponse,
  DiscordTokenResponse,
  DiscordUser,
  Scopes,
} from './types'

type FacebookAuthFlow = {
  client_id: string
  client_secret: string
  redirect_uri: string
  scope: Scopes[]
  state: string
  code: string | undefined
  token: Token | undefined
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
  user: Partial<DiscordUser> | undefined

  constructor({
    client_id,
    client_secret,
    redirect_uri,
    scope,
    state,
    code,
    token,
  }: FacebookAuthFlow) {
    this.client_id = client_id
    this.client_secret = client_secret
    this.redirect_uri = redirect_uri
    this.scope = scope.join(' ')
    this.state = state
    this.code = code
    this.refresh_token = undefined
    this.token = token
    this.granted_scopes = undefined
    this.user = undefined
  }

  redirect() {
    const parsedOptions = toQueryParams({
      response_type: 'code',
      client_id: this.client_id,
      scope: this.scope,
      state: this.state,
      prompt: 'consent',
      redirect_uri: this.redirect_uri,
    })
    return `https://discord.com/oauth2/authorize?${parsedOptions}`
  }

  private async getTokenFromCode() {
    const parsedOptions = toQueryParams({
      client_id: this.client_id,
      client_secret: this.client_secret,
      grant_type: 'authorization_code',
      code: this.code,
      redirect_uri: this.redirect_uri,
    })

    const url = 'https://discord.com/api/oauth2/token'

    const response = (await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: parsedOptions,
    }).then((res) => res.json())) as DiscordTokenResponse | DiscordErrorResponse

    if ('error_description' in response) {
      throw new HTTPException(400, { message: response.error_description })
    }
    if ('error' in response) {
      throw new HTTPException(400, { message: response.error })
    }
    if ('message' in response) {
      throw new HTTPException(400, { message: response.message })
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
      this.granted_scopes = response.scope.split(' ')
    }
  }

  async getUserData(): Promise<void> {
    await this.getTokenFromCode()
    const response = (await fetch('https://discord.com/api/oauth2/@me', {
      headers: {
        authorization: `Bearer ${this.token?.token}`,
      },
    }).then((res) => res.json())) as DiscordMeResponse | DiscordErrorResponse

    if ('error_description' in response) {
      throw new HTTPException(400, { message: response.error_description })
    }
    if ('error' in response) {
      throw new HTTPException(400, { message: response.error })
    }
    if ('message' in response) {
      throw new HTTPException(400, { message: response.message })
    }

    if ('user' in response) {
      this.user = response.user
    }
  }
}
