import { HTTPException } from 'hono/http-exception'

import type { Token } from '../../types'
import { toQueryParams } from '../../utils/toQueryParams'
import type { FacebookErrorResponse, FacebookMeResponse, FacebookTokenResponse, FacebookUser, Fields, Permissions, FacebookResponseType } from './types'

type FacebookAuthFlow = {
  client_id: string
  client_secret: string
  redirect_uri: string
  response_type: FacebookResponseType[]
  scope: Permissions[]
  include_granted_scopes: boolean,
  fields: Fields[]
  state: string | undefined
  code: string | undefined
  token: Token | undefined
}

export class AuthFlow {
  client_id: string
  client_secret: string
  redirect_uri: string
  response_type: string[]
  scope: Permissions[]
  include_granted_scopes: boolean
  fields: Fields[]
  state: string | undefined
  code: string | undefined
  token: Token | undefined
  user: Partial<FacebookUser> | undefined

  constructor({client_id, client_secret,
    redirect_uri, response_type, scope,
    include_granted_scopes, state, fields,
    code, token
  }: FacebookAuthFlow) {
    this.client_id = client_id
    this.client_secret = client_secret
    this.redirect_uri = redirect_uri
    this.response_type = include_granted_scopes ? [...response_type, 'granted_scopes'] : response_type
    this.scope = scope
    this.include_granted_scopes = include_granted_scopes || false
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
      response_type: this.response_type,
      scope: this.scope,
      state: this.state
    })
    return `https://www.facebook.com/v18.0/dialog/oauth?${parsedOptions}`
  }

  private async getTokenFromCode() {
    const parsedOptions = toQueryParams({
      client_id: this.client_id,
      redirect_uri: this.redirect_uri,
      client_secret: this.client_secret,
      code: this.code
    })
    const url = `https://graph.facebook.com/v18.0/oauth/access_token?${parsedOptions}`

    const response = await fetch(url)
      .then(res => res.json()) as FacebookTokenResponse

    this.resError(response)

    this.token = {
      token: response.access_token,
      expires_in: response.expires_in
    }
  }

  private async getUserId() {
    const response = await fetch(`https://graph.facebook.com/v18.0/me?access_token=${this.token?.token}`)
      .then(res => res.json()) as FacebookMeResponse

    this.resError(response)

    this.user = response
  }

  private resError(response: FacebookErrorResponse) {
    if (response.error) throw new HTTPException(500, { message: response.error?.message })
  }

  async getUserData() {
    if (this.response_type.includes('code'))  await this.getTokenFromCode()

    await this.getUserId()
    const parsedFields = this.fields.join()
    const response = await fetch(`https://graph.facebook.com/${this.user?.id}?fields=${parsedFields}&access_token=${this.token?.token}`)
      .then(res => res.json()) as FacebookUser

    this.resError(response)

    this.user = response
  }
}