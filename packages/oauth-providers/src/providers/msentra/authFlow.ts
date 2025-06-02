import { HTTPException } from 'hono/http-exception'

import { toQueryParams } from '../../utils/objectToQuery'
import type { MSEntraErrorResponse, MSEntraToken, MSEntraTokenResponse, MSEntraUser } from './types'

type MSEntraAuthFlow = {
  client_id: string
  client_secret: string
  tenant_id: string
  redirect_uri: string
  code: string | undefined
  token: MSEntraToken | undefined
  scope: string[]
  state?: string
}

export class AuthFlow {
  client_id: string
  client_secret: string
  tenant_id: string
  redirect_uri: string
  code: string | undefined
  token: MSEntraToken | undefined
  scope: string[]
  state: string | undefined
  user: Partial<MSEntraUser> | undefined
  granted_scopes: string[] | undefined

  constructor({
    client_id,
    client_secret,
    tenant_id,
    redirect_uri,
    code,
    token,
    scope,
    state,
  }: MSEntraAuthFlow) {
    this.client_id = client_id
    this.client_secret = client_secret
    this.tenant_id = tenant_id
    this.redirect_uri = redirect_uri
    this.code = code
    this.token = token
    this.scope = scope
    this.state = state
    this.user = undefined

    if (
      this.client_id === undefined ||
      this.client_secret === undefined ||
      this.tenant_id === undefined ||
      this.scope.length <= 0
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
    return `https://login.microsoft.com/${this.tenant_id}/oauth2/v2.0/authorize?${parsedOptions}`
  }

  async getTokenFromCode() {
    const parsedOptions = toQueryParams({
      client_id: this.client_id,
      client_secret: this.client_secret,
      redirect_uri: this.redirect_uri,
      code: this.code,
      grant_type: 'authorization_code',
    })
    const response = (await fetch(
      `https://login.microsoft.com/${this.tenant_id}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: parsedOptions,
      }
    ).then((res) => res.json())) as MSEntraTokenResponse | MSEntraErrorResponse

    if ('error' in response) {
      throw new HTTPException(400, { message: response.error })
    }

    if ('access_token' in response) {
      this.token = {
        token: response.access_token,
        expires_in: response.expires_in,
        refresh_token: response.refresh_token,
      }

      this.granted_scopes = response.scope.split(' ')
    }
  }

  async getUserData() {
    await this.getTokenFromCode()
    //TODO: add support for extra fields
    const response = (await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        authorization: `Bearer ${this.token?.token}`,
      },
    }).then(async (res) => res.json())) as MSEntraUser | MSEntraErrorResponse

    if ('error' in response) {
      throw new HTTPException(400, { message: response.error })
    }

    if ('id' in response) {
      this.user = response
    }
  }
}
