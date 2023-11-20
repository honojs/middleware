import { HTTPException } from 'hono/http-exception'

import type { Token } from '../../types'
import { toQueryParams } from '../../utils/objectToQuery'
import type {
  FacebookErrorResponse,
  FacebookMeResponse,
  FacebookTokenResponse,
  FacebookUser,
  Fields,
  Permissions,
} from './types'

type FacebookAuthFlow = {
  client_id: string
  client_secret: string
  redirect_uri: string
  scope: Permissions[]
  fields: Fields[]
  state: string
  code: string | undefined
  token: Token | undefined
}

export class AuthFlow {
  client_id: string
  client_secret: string
  redirect_uri: string
  scope: Permissions[]
  fields: Fields[]
  state: string
  code: string | undefined
  token: Token | undefined
  user: Partial<FacebookUser> | undefined

  constructor({
    client_id,
    client_secret,
    redirect_uri,
    scope,
    state,
    fields,
    code,
    token,
  }: FacebookAuthFlow) {
    this.client_id = client_id
    this.client_secret = client_secret
    this.redirect_uri = redirect_uri
    this.scope = scope
    this.fields = fields
    this.state = state
    this.code = code
    this.token = token
    this.user = undefined
  }

  redirect() {
    const parsedOptions = toQueryParams({
      client_id: this.client_id,
      redirect_uri: this.redirect_uri,
      response_type: ['code', 'granted_scopes'],
      scope: this.scope,
      state: this.state,
    })
    return `https://www.facebook.com/v18.0/dialog/oauth?${parsedOptions}`
  }

  private async getTokenFromCode() {
    const parsedOptions = toQueryParams({
      client_id: this.client_id,
      redirect_uri: this.redirect_uri,
      client_secret: this.client_secret,
      code: this.code,
    })
    const url = `https://graph.facebook.com/v18.0/oauth/access_token?${parsedOptions}`

    const response = (await fetch(url).then((res) => res.json())) as
      | FacebookTokenResponse
      | FacebookErrorResponse

    if ('error' in response) throw new HTTPException(400, { message: response.error?.message })

    if ('access_token' in response) {
      this.token = {
        token: response.access_token,
        expires_in: response.expires_in,
      }
    }
  }

  private async getUserId() {
    const response = (await fetch(
      `https://graph.facebook.com/v18.0/me?access_token=${this.token?.token}`
    ).then((res) => res.json())) as FacebookMeResponse | FacebookErrorResponse

    if ('error' in response) throw new HTTPException(400, { message: response.error?.message })

    if ('id' in response) this.user = response
  }

  async getUserData() {
    await this.getTokenFromCode()

    await this.getUserId()
    const parsedFields = this.fields.join()
    const response = (await fetch(
      `https://graph.facebook.com/${this.user?.id}?fields=${parsedFields}&access_token=${this.token?.token}`
    ).then((res) => res.json())) as FacebookUser | FacebookErrorResponse

    if ('error' in response) throw new HTTPException(400, { message: response.error?.message })

    if ('id' in response) this.user = response
  }
}
