import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js'
import { InvalidTokenError } from '@modelcontextprotocol/sdk/server/auth/errors.js'
import type {
  AuthorizationParams,
  OAuthServerProvider,
} from '@modelcontextprotocol/sdk/server/auth/provider.js'
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import type {
  OAuthClientInformationFull,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js'
import type { Context } from 'hono'
import { Hono } from 'hono'
import { authorizeHandler } from './authorize'

describe('Authorization Handler', () => {
  // Mock client data
  const validClient: OAuthClientInformationFull = {
    client_id: 'valid-client',
    client_secret: 'valid-secret',
    redirect_uris: ['https://example.com/callback'],
    scope: 'profile email',
  }

  const multiRedirectClient: OAuthClientInformationFull = {
    client_id: 'multi-redirect-client',
    client_secret: 'valid-secret',
    redirect_uris: ['https://example.com/callback1', 'https://example.com/callback2'],
    scope: 'profile email',
  }

  // Mock client store
  const mockClientStore: OAuthRegisteredClientsStore = {
    async getClient(clientId: string): Promise<OAuthClientInformationFull | undefined> {
      if (clientId === 'valid-client') {
        return validClient
      } else if (clientId === 'multi-redirect-client') {
        return multiRedirectClient
      }
      return undefined
    },
  }

  // Mock provider
  const mockProvider: OAuthServerProvider = {
    clientsStore: mockClientStore,

    async authorize(
      client: OAuthClientInformationFull,
      params: AuthorizationParams,
      ctx: Context
    ): Promise<void> {
      // Mock implementation - redirects to redirectUri with code and state
      const redirectUrl = new URL(params.redirectUri)
      redirectUrl.searchParams.set('code', 'mock_auth_code')
      if (params.state) {
        redirectUrl.searchParams.set('state', params.state)
      }
      ctx.redirect(redirectUrl.toString())
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

    async revokeToken(): Promise<void> {
      // Do nothing in mock
    },
  }

  // Setup hono app with handler
  let app: Hono

  beforeEach(() => {
    app = new Hono()
    app.post('/authorize', authorizeHandler(mockProvider))
  })

  describe('HTTP method validation', () => {
    it('rejects non-GET/POST methods', async () => {
      const response = await app.request('/authorize', {
        method: 'PUT',
        body: JSON.stringify({ client_id: 'valid-client' }),
      })

      expect(response.status).toBe(405) // Method not allowed response from handler
    })
  })

  describe('Client validation', () => {
    it('requires client_id parameter', async () => {
      const response = await app.request('/authorize')

      expect(response.status).toBe(400)
      expect(response.text).toContain('client_id')
    })

    it('validates that client exists', async () => {
      const url = new URL('/authorize')
      url.searchParams.set('client_id', 'nonexistent-client')
      const response = await app.request(url)

      expect(response.status).toBe(400)
    })
  })

  describe('Redirect URI validation', () => {
    it('uses the only redirect_uri if client has just one and none provided', async () => {
      const url = new URL('/authorize')
      url.searchParams.set('client_id', 'valid-client')
      url.searchParams.set('response_type', 'code')
      url.searchParams.set('code_challenge', 'challenge123')
      url.searchParams.set('code_challenge_method', 'S256')
      const response = await app.request(url)

      expect(response.status).toBe(302)
      const location = new URL(response.headers.get('location')!)
      expect(location.origin + location.pathname).toBe('https://example.com/callback')
    })

    it('requires redirect_uri if client has multiple', async () => {
      const url = new URL('/authorize')
      url.searchParams.set('client_id', 'multi-redirect-client')
      url.searchParams.set('response_type', 'code')
      url.searchParams.set('code_challenge', 'challenge123')
      url.searchParams.set('code_challenge_method', 'S256')
      const response = await app.request(url)

      expect(response.status).toBe(400)
    })

    it('validates redirect_uri against client registered URIs', async () => {
      const url = new URL('/authorize')
      url.searchParams.set('client_id', 'valid-client')
      url.searchParams.set('redirect_uri', 'https://malicious.com/callback')
      url.searchParams.set('response_type', 'code')
      url.searchParams.set('code_challenge', 'challenge123')
      url.searchParams.set('code_challenge_method', 'S256')
      const response = await app.request(url)

      expect(response.status).toBe(400)
    })

    it('accepts valid redirect_uri that client registered with', async () => {
      const url = new URL('/authorize')
      url.searchParams.set('client_id', 'valid-client')
      url.searchParams.set('redirect_uri', 'https://example.com/callback')
      url.searchParams.set('response_type', 'code')
      url.searchParams.set('code_challenge', 'challenge123')
      url.searchParams.set('code_challenge_method', 'S256')
      const response = await app.request(url)

      expect(response.status).toBe(302)
      const location = new URL(response.headers.get('location')!)
      expect(location.origin + location.pathname).toBe('https://example.com/callback')
    })
  })

  describe('Authorization request validation', () => {
    it('requires response_type=code', async () => {
      const url = new URL('/authorize')
      url.searchParams.set('client_id', 'valid-client')
      url.searchParams.set('redirect_uri', 'https://example.com/callback')
      url.searchParams.set('response_type', 'token') // invalid - we only support code flow
      url.searchParams.set('code_challenge', 'challenge123')
      url.searchParams.set('code_challenge_method', 'S256')
      const response = await app.request(url)

      expect(response.status).toBe(302)
      const location = new URL(response.headers.get('location')!)
      expect(location.searchParams.get('error')).toBe('invalid_request')
    })

    it('requires code_challenge parameter', async () => {
      const url = new URL('/authorize')
      url.searchParams.set('client_id', 'valid-client')
      url.searchParams.set('redirect_uri', 'https://example.com/callback')
      url.searchParams.set('response_type', 'code')
      url.searchParams.set('code_challenge_method', 'S256')
      const response = await app.request(url)

      expect(response.status).toBe(302)
      const location = new URL(response.headers.get('location')!)
      expect(location.searchParams.get('error')).toBe('invalid_request')
    })

    it('requires code_challenge_method=S256', async () => {
      const url = new URL('/authorize')
      url.searchParams.set('client_id', 'valid-client')
      url.searchParams.set('redirect_uri', 'https://example.com/callback')
      url.searchParams.set('response_type', 'code')
      url.searchParams.set('code_challenge', 'challenge123')
      url.searchParams.set('code_challenge_method', 'plain') // Only S256 is supported
      const response = await app.request(url)

      expect(response.status).toBe(302)
      const location = new URL(response.headers.get('location')!)
      expect(location.searchParams.get('error')).toBe('invalid_request')
    })
  })

  describe('Scope validation', () => {
    it('validates requested scopes against client registered scopes', async () => {
      const url = new URL('/authorize')
      url.searchParams.set('client_id', 'valid-client')
      url.searchParams.set('redirect_uri', 'https://example.com/callback')
      url.searchParams.set('response_type', 'code')
      url.searchParams.set('code_challenge', 'challenge123')
      url.searchParams.set('code_challenge_method', 'S256')
      url.searchParams.set('scope', 'profile email admin') // 'admin' not in client scopes
      const response = await app.request(url)

      expect(response.status).toBe(302)
      const location = new URL(response.headers.get('location')!)
      expect(location.searchParams.get('error')).toBe('invalid_scope')
    })

    it('accepts valid scopes subset', async () => {
      const url = new URL('/authorize')
      url.searchParams.set('client_id', 'valid-client')
      url.searchParams.set('redirect_uri', 'https://example.com/callback')
      url.searchParams.set('response_type', 'code')
      url.searchParams.set('code_challenge', 'challenge123')
      url.searchParams.set('code_challenge_method', 'S256')
      url.searchParams.set('scope', 'profile') // subset of client scopes
      const response = await app.request(url)

      expect(response.status).toBe(302)
      const location = new URL(response.headers.get('location')!)
      expect(location.searchParams.has('code')).toBe(true)
    })
  })

  describe('Resource parameter validation', () => {
    it('propagates resource parameter', async () => {
      const mockProviderWithResource = vi.spyOn(mockProvider, 'authorize')

      const url = new URL('/authorize')
      url.searchParams.set('client_id', 'valid-client')
      url.searchParams.set('redirect_uri', 'https://example.com/callback')
      url.searchParams.set('response_type', 'code')
      url.searchParams.set('code_challenge', 'challenge123')
      url.searchParams.set('code_challenge_method', 'S256')
      url.searchParams.set('resource', 'https://api.example.com/resource')
      const response = await app.request(url)

      expect(response.status).toBe(302)
      expect(mockProviderWithResource).toHaveBeenCalledWith(
        validClient,
        expect.objectContaining({
          resource: new URL('https://api.example.com/resource'),
          redirectUri: 'https://example.com/callback',
          codeChallenge: 'challenge123',
        }),
        expect.any(Object)
      )
    })
  })

  describe('Successful authorization', () => {
    it('handles successful authorization with all parameters', async () => {
      const url = new URL('/authorize')
      url.searchParams.set('client_id', 'valid-client')
      url.searchParams.set('redirect_uri', 'https://example.com/callback')
      url.searchParams.set('response_type', 'code')
      url.searchParams.set('code_challenge', 'challenge123')
      url.searchParams.set('code_challenge_method', 'S256')
      url.searchParams.set('scope', 'profile email')
      url.searchParams.set('state', 'xyz789')
      const response = await app.request(url)

      expect(response.status).toBe(302)
      const location = new URL(response.headers.get('location')!)
      expect(location.origin + location.pathname).toBe('https://example.com/callback')
      expect(location.searchParams.get('code')).toBe('mock_auth_code')
      expect(location.searchParams.get('state')).toBe('xyz789')
    })

    it('preserves state parameter in response', async () => {
      const url = new URL('/authorize')
      url.searchParams.set('client_id', 'valid-client')
      url.searchParams.set('redirect_uri', 'https://example.com/callback')
      url.searchParams.set('response_type', 'code')
      url.searchParams.set('code_challenge', 'challenge123')
      url.searchParams.set('code_challenge_method', 'S256')
      url.searchParams.set('state', 'state-value-123')
      const response = await app.request(url)

      expect(response.status).toBe(302)
      const location = new URL(response.headers.get('location')!)
      expect(location.searchParams.get('state')).toBe('state-value-123')
    })

    it('handles POST requests the same as GET', async () => {
      const url = new URL('/authorize')
      url.searchParams.set('client_id', 'valid-client')
      url.searchParams.set('redirect_uri', 'https://example.com/callback')
      url.searchParams.set('response_type', 'code')
      url.searchParams.set('code_challenge', 'challenge123')
      url.searchParams.set('code_challenge_method', 'S256')
      const response = await app.request(url)

      expect(response.status).toBe(302)
      const location = new URL(response.headers.get('location')!)
      expect(location.searchParams.has('code')).toBe(true)
    })
  })
})
