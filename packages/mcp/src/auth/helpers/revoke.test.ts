import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js'
import { InvalidTokenError } from '@modelcontextprotocol/sdk/server/auth/errors.js'
import type {
  OAuthServerProvider,
  AuthorizationParams,
} from '@modelcontextprotocol/sdk/server/auth/provider.js'
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import type {
  OAuthClientInformationFull,
  OAuthTokenRevocationRequest,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js'
import type { Context } from 'hono'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { authenticateClient } from '../middleware/clientAuth'
import { revokeHandler } from './revoke'

describe('Revocation Handler', () => {
  // Mock client data
  const validClient: OAuthClientInformationFull = {
    client_id: 'valid-client',
    client_secret: 'valid-secret',
    redirect_uris: ['https://example.com/callback'],
  }

  // Mock client store
  const mockClientStore: OAuthRegisteredClientsStore = {
    async getClient(clientId: string): Promise<OAuthClientInformationFull | undefined> {
      if (clientId === 'valid-client') {
        return validClient
      }
      return undefined
    },
  }

  // Mock provider with revocation capability
  const mockProviderWithRevocation: OAuthServerProvider = {
    clientsStore: mockClientStore,

    async authorize(
      _client: OAuthClientInformationFull,
      _params: AuthorizationParams,
      ctx: Context
    ): Promise<void> {
      ctx.res = ctx.redirect('https://example.com/callback?code=mock_auth_code')
    },

    async challengeForAuthorizationCode(): Promise<string> {
      return 'mock_challenge'
    },

    async exchangeAuthorizationCode(): Promise<OAuthTokens> {
      return {
        access_token: 'mock_access_token',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'mock_refresh_token',
      }
    },

    async exchangeRefreshToken(): Promise<OAuthTokens> {
      return {
        access_token: 'new_mock_access_token',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'new_mock_refresh_token',
      }
    },

    async verifyAccessToken(token: string): Promise<AuthInfo> {
      if (token === 'valid_token') {
        return {
          token,
          clientId: 'valid-client',
          scopes: ['read', 'write'],
          expiresAt: Date.now() / 1000 + 3600,
        }
      }
      throw new InvalidTokenError('Token is invalid or expired')
    },

    async revokeToken(
      _client: OAuthClientInformationFull,
      _request: OAuthTokenRevocationRequest
    ): Promise<void> {
      // Success - do nothing in mock
    },
  }

  // Mock provider without revocation capability
  const mockProviderWithoutRevocation: OAuthServerProvider = {
    clientsStore: mockClientStore,

    async authorize(
      _client: OAuthClientInformationFull,
      _params: AuthorizationParams,
      ctx: Context
    ): Promise<void> {
      ctx.res = ctx.redirect('https://example.com/callback?code=mock_auth_code')
    },

    async challengeForAuthorizationCode(): Promise<string> {
      return 'mock_challenge'
    },

    async exchangeAuthorizationCode(): Promise<OAuthTokens> {
      return {
        access_token: 'mock_access_token',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'mock_refresh_token',
      }
    },

    async exchangeRefreshToken(): Promise<OAuthTokens> {
      return {
        access_token: 'new_mock_access_token',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'new_mock_refresh_token',
      }
    },

    async verifyAccessToken(token: string): Promise<AuthInfo> {
      if (token === 'valid_token') {
        return {
          token,
          clientId: 'valid-client',
          scopes: ['read', 'write'],
          expiresAt: Date.now() / 1000 + 3600,
        }
      }
      throw new InvalidTokenError('Token is invalid or expired')
    },
    // No revokeToken method
  }

  describe('Handler creation', () => {
    it('throws error if provider does not support token revocation', () => {
      expect(() => revokeHandler(mockProviderWithoutRevocation)).toThrow(
        'does not support revoking tokens'
      )
    })

    it('creates handler if provider supports token revocation', () => {
      expect(() => revokeHandler(mockProviderWithRevocation)).not.toThrow()
    })
  })

  describe('Request handling', () => {
    let app: Hono
    let spyRevokeToken: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      // Setup express app with revocation handler
      app = new Hono()
      app.post(
        '/revoke',
        cors(),
        authenticateClient({
          clientsStore: mockProviderWithRevocation.clientsStore,
        }),
        revokeHandler(mockProviderWithRevocation)
      )

      // Spy on the revokeToken method
      spyRevokeToken = vi.spyOn(mockProviderWithRevocation, 'revokeToken')
    })

    afterEach(() => {
      spyRevokeToken.mockRestore()
    })

    it('requires token parameter', async () => {
      const response = await app.request('/revoke', {
        method: 'POST',
        body: JSON.stringify({
          client_id: 'valid-client',
          client_secret: 'valid-secret',
          // Missing token
        }),
      })

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toEqual('invalid_request')
      expect(spyRevokeToken).not.toHaveBeenCalled()
    })

    it('authenticates client before revoking token', async () => {
      const response = await app.request('/revoke', {
        method: 'POST',
        body: JSON.stringify({
          client_id: 'invalid-client',
          client_secret: 'wrong-secret',
          token: 'token_to_revoke',
        }),
      })

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toEqual('invalid_client')
      expect(spyRevokeToken).not.toHaveBeenCalled()
    })

    it('successfully revokes token', async () => {
      const response = await app.request('/revoke', {
        method: 'POST',
        body: JSON.stringify({
          client_id: 'valid-client',
          client_secret: 'valid-secret',
          token: 'token_to_revoke',
        }),
      })

      expect(response.status).toBe(200)
      expect(await response.text()).toEqual('{}') // Empty response on success
      expect(spyRevokeToken).toHaveBeenCalledTimes(1)
      expect(spyRevokeToken).toHaveBeenCalledWith(validClient, {
        token: 'token_to_revoke',
      })
    })

    it('accepts optional token_type_hint', async () => {
      const response = await app.request('/revoke', {
        method: 'POST',
        body: JSON.stringify({
          client_id: 'valid-client',
          client_secret: 'valid-secret',
          token: 'token_to_revoke',
          token_type_hint: 'refresh_token',
        }),
      })

      expect(response.status).toBe(200)
      expect(spyRevokeToken).toHaveBeenCalledWith(validClient, {
        token: 'token_to_revoke',
        token_type_hint: 'refresh_token',
      })
    })

    it('includes CORS headers in response', async () => {
      const response = await app.request('/revoke', {
        method: 'POST',
        headers: {
          Origin: 'https://example.com',
        },
        body: JSON.stringify({
          client_id: 'valid-client',
          client_secret: 'valid-secret',
          token: 'token_to_revoke',
        }),
      })

      expect(response.headers.get('access-control-allow-origin')).toBe('*')
    })
  })
})
