import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js'
import { ServerError } from '@modelcontextprotocol/sdk/server/auth/errors.js'
import type {
  AuthorizationParams,
  OAuthServerProvider,
} from '@modelcontextprotocol/sdk/server/auth/provider.js'
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import type {
  OAuthClientInformationFull,
  OAuthTokenRevocationRequest,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js'
import {
  OAuthClientInformationFullSchema,
  OAuthTokensSchema,
} from '@modelcontextprotocol/sdk/shared/auth.js'
import type { FetchLike } from '@modelcontextprotocol/sdk/shared/transport.js'
import type { Context } from 'hono'

export type ProxyEndpoints = {
  authorizationUrl: string
  tokenUrl: string
  revocationUrl?: string
  registrationUrl?: string
}

export type ProxyOptions = {
  /**
   * Individual endpoint URLs for proxying specific OAuth operations
   */
  endpoints: ProxyEndpoints

  /**
   * Function to verify access tokens and return auth info
   */
  verifyAccessToken: (token: string) => Promise<AuthInfo>

  /**
   * Function to fetch client information from the upstream server
   */
  getClient: (clientId: string) => Promise<OAuthClientInformationFull | undefined>

  /**
   * Custom fetch implementation used for all network requests.
   */
  fetch?: FetchLike
}

/**
 * Implements an OAuth server that proxies requests to another OAuth server.
 */
export class ProxyOAuthServerProvider implements OAuthServerProvider {
  protected readonly _endpoints: ProxyEndpoints
  protected readonly _verifyAccessToken: (token: string) => Promise<AuthInfo>
  protected readonly _getClient: (
    clientId: string
  ) => Promise<OAuthClientInformationFull | undefined>
  protected readonly _fetch?: FetchLike

  skipLocalPkceValidation = true

  revokeToken?: (
    client: OAuthClientInformationFull,
    request: OAuthTokenRevocationRequest
  ) => Promise<void>

  constructor(options: ProxyOptions) {
    this._endpoints = options.endpoints
    this._verifyAccessToken = options.verifyAccessToken
    this._getClient = options.getClient
    this._fetch = options.fetch
    if (options.endpoints?.revocationUrl) {
      this.revokeToken = async (
        client: OAuthClientInformationFull,
        request: OAuthTokenRevocationRequest
      ) => {
        const revocationUrl = this._endpoints.revocationUrl

        if (!revocationUrl) {
          throw new Error('No revocation endpoint configured')
        }

        const params = new URLSearchParams()
        params.set('token', request.token)
        params.set('client_id', client.client_id)
        if (client.client_secret) {
          params.set('client_secret', client.client_secret)
        }
        if (request.token_type_hint) {
          params.set('token_type_hint', request.token_type_hint)
        }

        const response = await (this._fetch ?? fetch)(revocationUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        })

        if (!response.ok) {
          throw new ServerError(`Token revocation failed: ${response.status}`)
        }
      }
    }
  }

  get clientsStore(): OAuthRegisteredClientsStore {
    const registrationUrl = this._endpoints.registrationUrl
    return {
      getClient: this._getClient,
      ...(registrationUrl && {
        registerClient: async (client: OAuthClientInformationFull) => {
          const response = await (this._fetch ?? fetch)(registrationUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(client),
          })

          if (!response.ok) {
            throw new ServerError(`Client registration failed: ${response.status}`)
          }

          const data = await response.json()
          return OAuthClientInformationFullSchema.parse(data)
        },
      }),
    }
  }

  async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    c: Context
  ): Promise<void> {
    // Start with required OAuth parameters
    const targetUrl = new URL(this._endpoints.authorizationUrl)
    const searchParams = new URLSearchParams({
      client_id: client.client_id,
      response_type: 'code',
      redirect_uri: params.redirectUri,
      code_challenge: params.codeChallenge,
      code_challenge_method: 'S256',
    })

    // Add optional standard OAuth parameters
    if (params.state) searchParams.set('state', params.state)
    if (params.scopes?.length) searchParams.set('scope', params.scopes.join(' '))
    if (params.resource) searchParams.set('resource', params.resource.href)

    targetUrl.search = searchParams.toString()
    c.res = c.redirect(targetUrl.toString())
  }

  async challengeForAuthorizationCode(
    _client: OAuthClientInformationFull,
    _authorizationCode: string
  ): Promise<string> {
    // In a proxy setup, we don't store the code challenge ourselves
    // Instead, we proxy the token request and let the upstream server validate it
    return ''
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    codeVerifier?: string,
    redirectUri?: string,
    resource?: URL
  ): Promise<OAuthTokens> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: client.client_id,
      code: authorizationCode,
    })

    if (client.client_secret) {
      params.append('client_secret', client.client_secret)
    }

    if (codeVerifier) {
      params.append('code_verifier', codeVerifier)
    }

    if (redirectUri) {
      params.append('redirect_uri', redirectUri)
    }

    if (resource) {
      params.append('resource', resource.href)
    }

    const response = await (this._fetch ?? fetch)(this._endpoints.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    if (!response.ok) {
      throw new ServerError(`Token exchange failed: ${response.status}`)
    }

    const data = await response.json()
    return OAuthTokensSchema.parse(data)
  }

  async exchangeRefreshToken(
    client: OAuthClientInformationFull,
    refreshToken: string,
    scopes?: string[],
    resource?: URL
  ): Promise<OAuthTokens> {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: client.client_id,
      refresh_token: refreshToken,
    })

    if (client.client_secret) {
      params.set('client_secret', client.client_secret)
    }

    if (scopes?.length) {
      params.set('scope', scopes.join(' '))
    }

    if (resource) {
      params.set('resource', resource.href)
    }

    const response = await (this._fetch ?? fetch)(this._endpoints.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    if (!response.ok) {
      throw new ServerError(`Token refresh failed: ${response.status}`)
    }

    const data = await response.json()
    return OAuthTokensSchema.parse(data)
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    return this._verifyAccessToken(token)
  }
}
