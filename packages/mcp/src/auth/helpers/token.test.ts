import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js'
import {
  InvalidGrantError,
  InvalidTokenError,
} from '@modelcontextprotocol/sdk/server/auth/errors.js'
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
import { Hono } from 'hono'
import type { Context } from 'hono'
import { cors } from 'hono/cors'
import * as pkceChallenge from 'pkce-challenge'
import type { Mock } from 'vitest'
import { authenticateClient } from '../middleware/client-auth.js'
import { ProxyOAuthServerProvider } from '../providers/proxy-provider.js'
import { tokenHandler } from './token.js'

// Mock pkce-challenge
vi.mock('pkce-challenge', () => ({
  verifyChallenge: vi.fn().mockImplementation(async (verifier, challenge) => {
    return verifier === 'valid_verifier' && challenge === 'mock_challenge'
  }),
}))

const mockTokens = {
  access_token: 'mock_access_token',
  token_type: 'bearer',
  expires_in: 3600,
  refresh_token: 'mock_refresh_token',
}

const mockTokensWithIdToken = {
  ...mockTokens,
  id_token: 'mock_id_token',
}

describe('Token Handler', () => {
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

  // Mock provider
  let mockProvider: OAuthServerProvider
  let app: Hono

  beforeEach(() => {
    // Create fresh mocks for each test
    mockProvider = {
      clientsStore: mockClientStore,

      async authorize(
        _client: OAuthClientInformationFull,
        _params: AuthorizationParams,
        ctx: Context
      ): Promise<void> {
        ctx.redirect('https://example.com/callback?code=mock_auth_code')
      },

      async challengeForAuthorizationCode(
        _client: OAuthClientInformationFull,
        authorizationCode: string
      ): Promise<string> {
        if (authorizationCode === 'valid_code') {
          return 'mock_challenge'
        } else if (authorizationCode === 'expired_code') {
          throw new InvalidGrantError('The authorization code has expired')
        }
        throw new InvalidGrantError('The authorization code is invalid')
      },

      async exchangeAuthorizationCode(
        _client: OAuthClientInformationFull,
        authorizationCode: string
      ): Promise<OAuthTokens> {
        if (authorizationCode === 'valid_code') {
          return mockTokens
        }
        throw new InvalidGrantError('The authorization code is invalid or has expired')
      },

      async exchangeRefreshToken(
        _client: OAuthClientInformationFull,
        refreshToken: string,
        scopes?: string[]
      ): Promise<OAuthTokens> {
        if (refreshToken === 'valid_refresh_token') {
          const response: OAuthTokens = {
            access_token: 'new_mock_access_token',
            token_type: 'bearer',
            expires_in: 3600,
            refresh_token: 'new_mock_refresh_token',
          }

          if (scopes) {
            response.scope = scopes.join(' ')
          }

          return response
        }
        throw new InvalidGrantError('The refresh token is invalid or has expired')
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
        // Do nothing in mock
      },
    }

    // Mock PKCE verification
    ;(pkceChallenge.verifyChallenge as Mock).mockImplementation(
      async (verifier: string, challenge: string) => {
        return verifier === 'valid_verifier' && challenge === 'mock_challenge'
      }
    )

    // Setup express app with token handler
    app = new Hono()
    app.post(
      '/token',
      cors(),
      authenticateClient({
        clientsStore: mockClientStore,
      }),
      tokenHandler(mockProvider)
    )
  })

  describe('Basic request validation', () => {
    it('requires grant_type parameter', async () => {
      const response = await app.request('/token', {
        method: 'POST',
        body: JSON.stringify({
          client_id: 'valid-client',
          client_secret: 'valid-secret',
          // Missing grant_type
        }),
      })

      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toBe('invalid_request')
    })

    it('rejects unsupported grant types', async () => {
      const response = await app.request('/token', {
        method: 'POST',
        body: JSON.stringify({
          client_id: 'valid-client',
          client_secret: 'valid-secret',
          grant_type: 'password', // Unsupported grant type
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toBe('unsupported_grant_type')
    })
  })

  describe('Client authentication', () => {
    it('requires valid client credentials', async () => {
      const response = await app.request('/token', {
        method: 'POST',
        body: JSON.stringify({
          client_id: 'invalid-client',
          client_secret: 'wrong-secret',
          grant_type: 'authorization_code',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toBe('invalid_client')
    })

    it('accepts valid client credentials', async () => {
      const response = await app.request('/token', {
        method: 'POST',
        body: JSON.stringify({
          client_id: 'valid-client',
          client_secret: 'valid-secret',
          grant_type: 'authorization_code',
          code: 'valid_code',
          code_verifier: 'valid_verifier',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      expect(response.status).toBe(200)
    })
  })

  describe('Authorization code grant', () => {
    it('requires code parameter', async () => {
      const response = await app.request('/token', {
        method: 'POST',
        body: JSON.stringify({
          client_id: 'valid-client',
          client_secret: 'valid-secret',
          grant_type: 'authorization_code',
          // Missing code
          code_verifier: 'valid_verifier',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toBe('invalid_request')
    })

    it('requires code_verifier parameter', async () => {
      const response = await app.request('/token', {
        method: 'POST',
        body: JSON.stringify({
          client_id: 'valid-client',
          client_secret: 'valid-secret',
          grant_type: 'authorization_code',
          code: 'valid_code',
          // Missing code_verifier
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toBe('invalid_request')
    })

    it('verifies code_verifier against challenge', async () => {
      // Setup invalid verifier
      ;(pkceChallenge.verifyChallenge as Mock).mockResolvedValueOnce(false)

      const response = await app.request('/token', {
        method: 'POST',
        body: JSON.stringify({
          client_id: 'valid-client',
          client_secret: 'valid-secret',
          grant_type: 'authorization_code',
          code: 'valid_code',
          code_verifier: 'invalid_verifier',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toBe('invalid_grant')
      expect(body.error_description).toContain('code_verifier')
    })

    it('rejects expired or invalid authorization codes', async () => {
      const response = await app.request('/token', {
        method: 'POST',
        body: JSON.stringify({
          client_id: 'valid-client',
          client_secret: 'valid-secret',
          grant_type: 'authorization_code',
          code: 'expired_code',
          code_verifier: 'valid_verifier',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toBe('invalid_grant')
    })

    it('returns tokens for valid code exchange', async () => {
      const mockExchangeCode = vi.spyOn(mockProvider, 'exchangeAuthorizationCode')
      const response = await app.request('/token', {
        method: 'POST',
        body: JSON.stringify({
          client_id: 'valid-client',
          client_secret: 'valid-secret',
          resource: 'https://api.example.com/resource',
          grant_type: 'authorization_code',
          code: 'valid_code',
          code_verifier: 'valid_verifier',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.access_token).toBe('mock_access_token')
      expect(body.token_type).toBe('bearer')
      expect(body.expires_in).toBe(3600)
      expect(body.refresh_token).toBe('mock_refresh_token')
      expect(mockExchangeCode).toHaveBeenCalledWith(
        validClient,
        'valid_code',
        undefined, // code_verifier is undefined after PKCE validation
        undefined, // redirect_uri
        new URL('https://api.example.com/resource') // resource parameter
      )
    })

    it('returns id token in code exchange if provided', async () => {
      mockProvider.exchangeAuthorizationCode = async (
        _client: OAuthClientInformationFull,
        authorizationCode: string
      ): Promise<OAuthTokens> => {
        if (authorizationCode === 'valid_code') {
          return mockTokensWithIdToken
        }
        throw new InvalidGrantError('The authorization code is invalid or has expired')
      }

      const response = await app.request('/token', {
        method: 'POST',
        body: JSON.stringify({
          client_id: 'valid-client',
          client_secret: 'valid-secret',
          grant_type: 'authorization_code',
          code: 'valid_code',
          code_verifier: 'valid_verifier',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.id_token).toBe('mock_id_token')
    })

    it('passes through code verifier when using proxy provider', async () => {
      const originalFetch = global.fetch

      try {
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockTokens),
        })

        const proxyProvider = new ProxyOAuthServerProvider({
          endpoints: {
            authorizationUrl: 'https://example.com/authorize',
            tokenUrl: 'https://example.com/token',
          },
          verifyAccessToken: async (token) => ({
            token,
            clientId: 'valid-client',
            scopes: ['read', 'write'],
            expiresAt: Date.now() / 1000 + 3600,
          }),
          getClient: async (clientId) => (clientId === 'valid-client' ? validClient : undefined),
        })

        const proxyApp = new Hono()
        proxyApp.post(
          '/token',
          authenticateClient({
            clientsStore: proxyProvider.clientsStore,
          }),
          tokenHandler(proxyProvider)
        )

        const response = await proxyApp.request('/token', {
          method: 'POST',
          body: JSON.stringify({
            client_id: 'valid-client',
            client_secret: 'valid-secret',
            grant_type: 'authorization_code',
            code: 'valid_code',
            code_verifier: 'any_verifier',
            redirect_uri: 'https://example.com/callback',
          }),
          headers: {
            'Content-Type': 'application/json',
          },
        })

        const body = await response.json()

        expect(response.status).toBe(200)
        expect(body.access_token).toBe('mock_access_token')

        expect(global.fetch).toHaveBeenCalledWith(
          'https://example.com/token',
          expect.objectContaining({
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: expect.stringContaining('code_verifier=any_verifier'),
          })
        )
      } finally {
        global.fetch = originalFetch
      }
    })

    it('passes through redirect_uri when using proxy provider', async () => {
      const originalFetch = global.fetch

      try {
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockTokens),
        })

        const proxyProvider = new ProxyOAuthServerProvider({
          endpoints: {
            authorizationUrl: 'https://example.com/authorize',
            tokenUrl: 'https://example.com/token',
          },
          verifyAccessToken: async (token) => ({
            token,
            clientId: 'valid-client',
            scopes: ['read', 'write'],
            expiresAt: Date.now() / 1000 + 3600,
          }),
          getClient: async (clientId) => (clientId === 'valid-client' ? validClient : undefined),
        })

        const proxyApp = new Hono()
        proxyApp.post(
          '/token',
          authenticateClient({
            clientsStore: proxyProvider.clientsStore,
          }),
          tokenHandler(proxyProvider)
        )

        const redirectUri = 'https://example.com/callback'
        const response = await proxyApp.request('/token', {
          method: 'POST',
          body: JSON.stringify({
            client_id: 'valid-client',
            client_secret: 'valid-secret',
            grant_type: 'authorization_code',
            code: 'valid_code',
            code_verifier: 'any_verifier',
            redirect_uri: redirectUri,
          }),
          headers: {
            'Content-Type': 'application/json',
          },
        })

        const body = await response.json()

        expect(response.status).toBe(200)
        expect(body.access_token).toBe('mock_access_token')

        expect(global.fetch).toHaveBeenCalledWith(
          'https://example.com/token',
          expect.objectContaining({
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: expect.stringContaining(`redirect_uri=${encodeURIComponent(redirectUri)}`),
          })
        )
      } finally {
        global.fetch = originalFetch
      }
    })
  })

  describe('Refresh token grant', () => {
    it('requires refresh_token parameter', async () => {
      const response = await app.request('/token', {
        method: 'POST',
        body: JSON.stringify({
          client_id: 'valid-client',
          client_secret: 'valid-secret',
          grant_type: 'refresh_token',
          // Missing refresh_token
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toBe('invalid_request')
    })

    it('rejects invalid refresh tokens', async () => {
      const response = await app.request('/token', {
        method: 'POST',
        body: JSON.stringify({
          client_id: 'valid-client',
          client_secret: 'valid-secret',
          grant_type: 'refresh_token',
          refresh_token: 'invalid_refresh_token',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toBe('invalid_grant')
    })

    it('returns new tokens for valid refresh token', async () => {
      const mockExchangeRefresh = vi.spyOn(mockProvider, 'exchangeRefreshToken')
      const response = await app.request('/token', {
        method: 'POST',
        body: JSON.stringify({
          client_id: 'valid-client',
          client_secret: 'valid-secret',
          resource: 'https://api.example.com/resource',
          grant_type: 'refresh_token',
          refresh_token: 'valid_refresh_token',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.access_token).toBe('new_mock_access_token')
      expect(body.token_type).toBe('bearer')
      expect(body.expires_in).toBe(3600)
      expect(body.refresh_token).toBe('new_mock_refresh_token')
      expect(mockExchangeRefresh).toHaveBeenCalledWith(
        validClient,
        'valid_refresh_token',
        undefined, // scopes
        new URL('https://api.example.com/resource') // resource parameter
      )
    })

    it('respects requested scopes on refresh', async () => {
      const response = await app.request('/token', {
        method: 'POST',
        body: JSON.stringify({
          client_id: 'valid-client',
          client_secret: 'valid-secret',
          grant_type: 'refresh_token',
          refresh_token: 'valid_refresh_token',
          scope: 'profile email',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.scope).toBe('profile email')
    })
  })

  describe('CORS support', () => {
    it('includes CORS headers in response', async () => {
      const response = await app.request('/token', {
        method: 'POST',
        headers: {
          Origin: 'https://example.com',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: 'valid-client',
          client_secret: 'valid-secret',
          grant_type: 'authorization_code',
          code: 'valid_code',
          code_verifier: 'valid_verifier',
        }),
      })

      expect(response.headers.get('access-control-allow-origin')).toBe('*')
    })
  })
})
