import {
  InsufficientScopeError,
  InvalidTokenError,
  ServerError,
} from '@modelcontextprotocol/sdk/server/auth/errors.js'
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import type {
  OAuthClientInformationFull,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js'
import type { Context } from 'hono'
import type { Mock } from 'vitest'
import { ProxyOAuthServerProvider } from './proxy-provider.js'
import type { ProxyOptions } from './proxy-provider.js'

describe('Proxy OAuth Server Provider', () => {
  // Mock client data
  const validClient: OAuthClientInformationFull = {
    client_id: 'test-client',
    client_secret: 'test-secret',
    redirect_uris: ['https://example.com/callback'],
  }

  // Mock response object
  const mockResponse = {
    redirect: vi.fn(),
  } as unknown as Context

  // Mock provider functions
  const mockVerifyToken = vi.fn()
  const mockGetClient = vi.fn()

  // Base provider options
  const baseOptions: ProxyOptions = {
    endpoints: {
      authorizationUrl: 'https://auth.example.com/authorize',
      tokenUrl: 'https://auth.example.com/token',
      revocationUrl: 'https://auth.example.com/revoke',
      registrationUrl: 'https://auth.example.com/register',
    },
    verifyAccessToken: mockVerifyToken,
    getClient: mockGetClient,
  }

  let provider: ProxyOAuthServerProvider
  let originalFetch: typeof global.fetch

  beforeEach(() => {
    provider = new ProxyOAuthServerProvider(baseOptions)
    originalFetch = global.fetch
    global.fetch = vi.fn()

    // Setup mock implementations
    mockVerifyToken.mockImplementation(async (token: string) => {
      if (token === 'valid-token') {
        return {
          token,
          clientId: 'test-client',
          scopes: ['read', 'write'],
          expiresAt: Date.now() / 1000 + 3600,
        } as AuthInfo
      }
      throw new InvalidTokenError('Invalid token')
    })

    mockGetClient.mockImplementation(async (clientId: string) => {
      if (clientId === 'test-client') {
        return validClient
      }
      return undefined
    })
  })

  // Add helper function for failed responses
  const mockFailedResponse = () => {
    ;(global.fetch as Mock).mockImplementation(() =>
      Promise.resolve({
        ok: false,
        status: 400,
      })
    )
  }

  afterEach(() => {
    global.fetch = originalFetch
    vi.clearAllMocks()
  })

  describe('authorization', () => {
    it('redirects to authorization endpoint with correct parameters', async () => {
      await provider.authorize(
        validClient,
        {
          redirectUri: 'https://example.com/callback',
          codeChallenge: 'test-challenge',
          state: 'test-state',
          scopes: ['read', 'write'],
          resource: new URL('https://api.example.com/resource'),
        },
        mockResponse
      )

      const expectedUrl = new URL('https://auth.example.com/authorize')
      expectedUrl.searchParams.set('client_id', 'test-client')
      expectedUrl.searchParams.set('response_type', 'code')
      expectedUrl.searchParams.set('redirect_uri', 'https://example.com/callback')
      expectedUrl.searchParams.set('code_challenge', 'test-challenge')
      expectedUrl.searchParams.set('code_challenge_method', 'S256')
      expectedUrl.searchParams.set('state', 'test-state')
      expectedUrl.searchParams.set('scope', 'read write')
      expectedUrl.searchParams.set('resource', 'https://api.example.com/resource')

      expect(mockResponse.redirect).toHaveBeenCalledWith(expectedUrl.toString())
    })
  })

  describe('token exchange', () => {
    const mockTokenResponse: OAuthTokens = {
      access_token: 'new-access-token',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: 'new-refresh-token',
    }

    beforeEach(() => {
      ;(global.fetch as Mock).mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse),
        })
      )
    })

    it('exchanges authorization code for tokens', async () => {
      const tokens = await provider.exchangeAuthorizationCode(
        validClient,
        'test-code',
        'test-verifier'
      )

      expect(global.fetch).toHaveBeenCalledWith(
        'https://auth.example.com/token',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: expect.stringContaining('grant_type=authorization_code'),
        })
      )
      expect(tokens).toEqual(mockTokenResponse)
    })

    it('includes redirect_uri in token request when provided', async () => {
      const redirectUri = 'https://example.com/callback'
      const tokens = await provider.exchangeAuthorizationCode(
        validClient,
        'test-code',
        'test-verifier',
        redirectUri
      )

      expect(global.fetch).toHaveBeenCalledWith(
        'https://auth.example.com/token',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: expect.stringContaining(`redirect_uri=${encodeURIComponent(redirectUri)}`),
        })
      )
      expect(tokens).toEqual(mockTokenResponse)
    })

    it('includes resource parameter in authorization code exchange', async () => {
      const tokens = await provider.exchangeAuthorizationCode(
        validClient,
        'test-code',
        'test-verifier',
        'https://example.com/callback',
        new URL('https://api.example.com/resource')
      )

      expect(global.fetch).toHaveBeenCalledWith(
        'https://auth.example.com/token',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: expect.stringContaining(
            'resource=' + encodeURIComponent('https://api.example.com/resource')
          ),
        })
      )
      expect(tokens).toEqual(mockTokenResponse)
    })

    it('handles authorization code exchange without resource parameter', async () => {
      const tokens = await provider.exchangeAuthorizationCode(
        validClient,
        'test-code',
        'test-verifier'
      )

      const fetchCall = (global.fetch as Mock).mock.calls[0]
      const body = fetchCall[1].body as string
      expect(body).not.toContain('resource=')
      expect(tokens).toEqual(mockTokenResponse)
    })

    it('exchanges refresh token for new tokens', async () => {
      const tokens = await provider.exchangeRefreshToken(validClient, 'test-refresh-token', [
        'read',
        'write',
      ])

      expect(global.fetch).toHaveBeenCalledWith(
        'https://auth.example.com/token',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: expect.stringContaining('grant_type=refresh_token'),
        })
      )
      expect(tokens).toEqual(mockTokenResponse)
    })

    it('includes resource parameter in refresh token exchange', async () => {
      const tokens = await provider.exchangeRefreshToken(
        validClient,
        'test-refresh-token',
        ['read', 'write'],
        new URL('https://api.example.com/resource')
      )

      expect(global.fetch).toHaveBeenCalledWith(
        'https://auth.example.com/token',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: expect.stringContaining(
            'resource=' + encodeURIComponent('https://api.example.com/resource')
          ),
        })
      )
      expect(tokens).toEqual(mockTokenResponse)
    })
  })

  describe('client registration', () => {
    it('registers new client', async () => {
      const newClient: OAuthClientInformationFull = {
        client_id: 'new-client',
        redirect_uris: ['https://new-client.com/callback'],
      }

      ;(global.fetch as Mock).mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(newClient),
        })
      )

      const result = await provider.clientsStore.registerClient!(newClient)

      expect(global.fetch).toHaveBeenCalledWith(
        'https://auth.example.com/register',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(newClient),
        })
      )
      expect(result).toEqual(newClient)
    })

    it('handles registration failure', async () => {
      mockFailedResponse()
      const newClient: OAuthClientInformationFull = {
        client_id: 'new-client',
        redirect_uris: ['https://new-client.com/callback'],
      }

      await expect(provider.clientsStore.registerClient!(newClient)).rejects.toThrow(ServerError)
    })
  })

  describe('token revocation', () => {
    it('revokes token', async () => {
      ;(global.fetch as Mock).mockImplementation(() =>
        Promise.resolve({
          ok: true,
        })
      )

      await provider.revokeToken!(validClient, {
        token: 'token-to-revoke',
        token_type_hint: 'access_token',
      })

      expect(global.fetch).toHaveBeenCalledWith(
        'https://auth.example.com/revoke',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: expect.stringContaining('token=token-to-revoke'),
        })
      )
    })

    it('handles revocation failure', async () => {
      mockFailedResponse()
      await expect(
        provider.revokeToken!(validClient, {
          token: 'invalid-token',
        })
      ).rejects.toThrow(ServerError)
    })
  })

  describe('token verification', () => {
    it('verifies valid token', async () => {
      const validAuthInfo: AuthInfo = {
        token: 'valid-token',
        clientId: 'test-client',
        scopes: ['read', 'write'],
        expiresAt: Date.now() / 1000 + 3600,
      }
      mockVerifyToken.mockResolvedValue(validAuthInfo)

      const authInfo = await provider.verifyAccessToken('valid-token')
      expect(authInfo).toEqual(validAuthInfo)
      expect(mockVerifyToken).toHaveBeenCalledWith('valid-token')
    })

    it('passes through InvalidTokenError', async () => {
      const error = new InvalidTokenError('Token expired')
      mockVerifyToken.mockRejectedValue(error)

      await expect(provider.verifyAccessToken('invalid-token')).rejects.toBe(error)
      expect(mockVerifyToken).toHaveBeenCalledWith('invalid-token')
    })

    it('passes through InsufficientScopeError', async () => {
      const error = new InsufficientScopeError('Required scopes: read, write')
      mockVerifyToken.mockRejectedValue(error)

      await expect(provider.verifyAccessToken('token-with-insufficient-scope')).rejects.toBe(error)
      expect(mockVerifyToken).toHaveBeenCalledWith('token-with-insufficient-scope')
    })

    it('passes through unexpected errors', async () => {
      const error = new Error('Unexpected error')
      mockVerifyToken.mockRejectedValue(error)

      await expect(provider.verifyAccessToken('valid-token')).rejects.toBe(error)
      expect(mockVerifyToken).toHaveBeenCalledWith('valid-token')
    })
  })
})
