import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js'
import { InvalidTokenError } from '@modelcontextprotocol/sdk/server/auth/errors.js'
import type { OAuthServerProvider, AuthorizationParams } from '@modelcontextprotocol/sdk/server/auth/provider.js'
import type { AuthMetadataOptions } from '@modelcontextprotocol/sdk/server/auth/router.js'
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import type {
  OAuthClientInformationFull,
  OAuthMetadata,
  OAuthTokenRevocationRequest,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js'
import type { Context } from "hono";
import { Hono } from "hono";
import { wellKnownRouter, WellKnownRouterOptions } from "./helpers/wellknown"
import { mcpAuthRouter } from './router'
import type { AuthRouterOptions } from './router';

describe('MCP Auth Router', () => {
  // Setup mock provider with full capabilities
  const mockClientStore: OAuthRegisteredClientsStore = {
    async getClient(clientId: string): Promise<OAuthClientInformationFull | undefined> {
      if (clientId === 'valid-client') {
        return {
          client_id: 'valid-client',
          client_secret: 'valid-secret',
          redirect_uris: ['https://example.com/callback'],
        }
      }
      return undefined
    },

    async registerClient(client: OAuthClientInformationFull): Promise<OAuthClientInformationFull> {
      return client
    },
  }

  const mockProvider: OAuthServerProvider = {
    clientsStore: mockClientStore,

    async authorize(
      client: OAuthClientInformationFull,
      params: AuthorizationParams,
      ctx: Context
    ): Promise<void> {
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

    async revokeToken(
      _client: OAuthClientInformationFull,
      _request: OAuthTokenRevocationRequest
    ): Promise<void> {
      // Success - do nothing in mock
    },
  }

  // Provider without registration and revocation
  const mockProviderMinimal: OAuthServerProvider = {
    clientsStore: {
      async getClient(clientId: string): Promise<OAuthClientInformationFull | undefined> {
        if (clientId === 'valid-client') {
          return {
            client_id: 'valid-client',
            client_secret: 'valid-secret',
            redirect_uris: ['https://example.com/callback'],
          }
        }
        return undefined
      },
    },

    async authorize(
      client: OAuthClientInformationFull,
      params: AuthorizationParams,
      ctx: Context
    ): Promise<void> {
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
          scopes: ['read'],
          expiresAt: Date.now() / 1000 + 3600,
        }
      }
      throw new InvalidTokenError('Token is invalid or expired')
    },
  }

  describe('Router creation', () => {
    it('throws error for non-HTTPS issuer URL', () => {
      const options: AuthRouterOptions = {
        provider: mockProvider,
        issuerUrl: new URL('http://auth.example.com'),
      }

      expect(() => mcpAuthRouter(options)).toThrow('Issuer URL must be HTTPS')
    })

    it('allows localhost HTTP for development', () => {
      const options: AuthRouterOptions = {
        provider: mockProvider,
        issuerUrl: new URL('http://localhost:3000'),
      }

      expect(() => mcpAuthRouter(options)).not.toThrow()
    })

    it('throws error for issuer URL with fragment', () => {
      const options: AuthRouterOptions = {
        provider: mockProvider,
        issuerUrl: new URL('https://auth.example.com#fragment'),
      }

      expect(() => mcpAuthRouter(options)).toThrow('Issuer URL must not have a fragment')
    })

    it('throws error for issuer URL with query string', () => {
      const options: AuthRouterOptions = {
        provider: mockProvider,
        issuerUrl: new URL('https://auth.example.com?param=value'),
      }

      expect(() => mcpAuthRouter(options)).toThrow('Issuer URL must not have a query string')
    })

    it('successfully creates router with valid options', () => {
      const options: AuthRouterOptions = {
        provider: mockProvider,
        issuerUrl: new URL('https://auth.example.com'),
      }

      expect(() => mcpAuthRouter(options)).not.toThrow()
    })
  })

  describe('Metadata endpoint', () => {
    let app: Hono

    beforeEach(() => {
      // Setup full-featured router
      app = new Hono()
      const options: AuthRouterOptions = {
        provider: mockProvider,
        issuerUrl: new URL('https://auth.example.com'),
        serviceDocumentationUrl: new URL('https://docs.example.com'),
      }
      app.route('/', mcpAuthRouter(options))
    })

    it('returns complete metadata for full-featured router', async () => {
      const response = await app.request('/.well-known/oauth-authorization-server')

      expect(response.status).toBe(200)

      const body = await response.json()

      // Verify essential fields
      expect(body.issuer).toBe('https://auth.example.com/')
      expect(body.authorization_endpoint).toBe('https://auth.example.com/authorize')
      expect(body.token_endpoint).toBe('https://auth.example.com/token')
      expect(body.registration_endpoint).toBe('https://auth.example.com/register')
      expect(body.revocation_endpoint).toBe('https://auth.example.com/revoke')

      // Verify supported features
      expect(body.response_types_supported).toEqual(['code'])
      expect(body.grant_types_supported).toEqual(['authorization_code', 'refresh_token'])
      expect(body.code_challenge_methods_supported).toEqual(['S256'])
      expect(body.token_endpoint_auth_methods_supported).toEqual(['client_secret_post'])
      expect(body.revocation_endpoint_auth_methods_supported).toEqual([
        'client_secret_post',
      ])

      // Verify optional fields
      expect(body.service_documentation).toBe('https://docs.example.com/')
    })

    it('returns minimal metadata for minimal router', async () => {
      // Setup minimal router
      const minimalApp = new Hono()
      const options: AuthRouterOptions = {
        provider: mockProviderMinimal,
        issuerUrl: new URL('https://auth.example.com'),
      }
      minimalApp.route('/', mcpAuthRouter(options))

      const response = await minimalApp.request('/.well-known/oauth-authorization-server')

      expect(response.status).toBe(200)

      const body = await response.json()

      // Verify essential endpoints
      expect(body.issuer).toBe('https://auth.example.com/')
      expect(body.authorization_endpoint).toBe('https://auth.example.com/authorize')
      expect(body.token_endpoint).toBe('https://auth.example.com/token')

      // Verify missing optional endpoints
      expect(body.registration_endpoint).toBeUndefined()
      expect(body.revocation_endpoint).toBeUndefined()
      expect(body.revocation_endpoint_auth_methods_supported).toBeUndefined()
      expect(body.service_documentation).toBeUndefined()
    })

    it('provides protected resource metadata', async () => {
      // Setup router with draft protocol version
      const draftApp = new Hono()
      const options: AuthRouterOptions = {
        provider: mockProvider,
        issuerUrl: new URL('https://mcp.example.com'),
        scopesSupported: ['read', 'write'],
        resourceName: 'Test API',
      }
      draftApp.route('/', mcpAuthRouter(options))

      const response = await draftApp.request('/.well-known/oauth-protected-resource')

      expect(response.status).toBe(200)

      const body = await response.json()

      // Verify protected resource metadata
      expect(body.resource).toBe('https://mcp.example.com/')
      expect(body.authorization_servers).toContain('https://mcp.example.com/')
      expect(body.scopes_supported).toEqual(['read', 'write'])
      expect(body.resource_name).toBe('Test API')
    })
  })

  describe('Endpoint routing', () => {
    let app: Hono

    beforeEach(() => {
      // Setup full-featured router
      app = new Hono()
      const options: AuthRouterOptions = {
        provider: mockProvider,
        issuerUrl: new URL('https://auth.example.com'),
      }
      app.route('/', mcpAuthRouter(options))
      vi.spyOn(console, 'error').mockImplementation(() => { })
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('routes to authorization endpoint', async () => {
      const url = new URL('/authorize')

      url.searchParams.set('client_id', 'valid-client')
      url.searchParams.set('response_type', 'code')
      url.searchParams.set('code_challenge', 'challenge123')
      url.searchParams.set('code_challenge_method', 'S256')

      const response = await app.request(url.toString())

      expect(response.status).toBe(302)
      const location = new URL(response.headers.get('location')!)
      expect(location.searchParams.has('code')).toBe(true)
    })

    it('routes to token endpoint', async () => {
      // Setup verifyChallenge mock for token handler
      vi.mock('pkce-challenge', () => ({
        verifyChallenge: vi.fn().mockResolvedValue(true),
      }))

      const response = await app.request('/token', {
        method: 'POST',
        body: JSON.stringify({
          client_id: 'valid-client',
          client_secret: 'valid-secret',
          grant_type: 'authorization_code',
          code: 'valid_code',
          code_verifier: 'valid_verifier',
        }),
      })

      // The request will fail in testing due to mocking limitations,
      // but we can verify the route was matched
      expect(response.status).not.toBe(404)
    })

    it('routes to registration endpoint', async () => {
      const response = await app.request('/register', {
        method: 'POST',
        body: JSON.stringify({
          redirect_uris: ['https://example.com/callback'],
        }),
      })

      // The request will fail in testing due to mocking limitations,
      // but we can verify the route was matched
      expect(response.status).not.toBe(404)
    })

    it('routes to revocation endpoint', async () => {
      const response = await app.request('/revoke', {
        method: 'POST',
        body: JSON.stringify({
          client_id: 'valid-client',
          client_secret: 'valid-secret',
          token: 'token_to_revoke',
        }),
      })

      // The request will fail in testing due to mocking limitations,
      // but we can verify the route was matched
      expect(response.status).not.toBe(404)
    })

    it('excludes endpoints for unsupported features', async () => {
      // Setup minimal router
      const minimalApp = new Hono()
      const options: AuthRouterOptions = {
        provider: mockProviderMinimal,
        issuerUrl: new URL('https://auth.example.com'),
      }
      minimalApp.route('/', mcpAuthRouter(options))

      // Registration should not be available
      const regResponse = await minimalApp.request('/register', {
        method: 'POST',
        body: JSON.stringify({
          redirect_uris: ['https://example.com/callback'],
        }),
      })
      expect(regResponse.status).toBe(404)

      // Revocation should not be available
      const revokeResponse = await minimalApp.request('/revoke', {
        method: 'POST',
        body: JSON.stringify({
          client_id: 'valid-client',
          client_secret: 'valid-secret',
          token: 'token_to_revoke',
        }),
      })
      expect(revokeResponse.status).toBe(404)
    })
  })
})

describe('MCP Auth Metadata Router', () => {
  const mockOAuthMetadata: OAuthMetadata = {
    issuer: 'https://auth.example.com/',
    authorization_endpoint: 'https://auth.example.com/authorize',
    token_endpoint: 'https://auth.example.com/token',
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['client_secret_post'],
  }

  describe('Router creation', () => {
    it('successfully creates router with valid options', () => {
      const options: AuthMetadataOptions = {
        oauthMetadata: mockOAuthMetadata,
        resourceServerUrl: new URL('https://api.example.com'),
      }

      expect(() => wellKnownRouter(options)).not.toThrow()
    })
  })

  describe('Metadata endpoints', () => {
    let app: Hono

    beforeEach(() => {
      app = new Hono()
      const options: AuthMetadataOptions = {
        oauthMetadata: mockOAuthMetadata,
        resourceServerUrl: new URL('https://api.example.com'),
        serviceDocumentationUrl: new URL('https://docs.example.com'),
        scopesSupported: ['read', 'write'],
        resourceName: 'Test API',
      }
      app.route('/', wellKnownRouter(options))
    })

    it('returns OAuth authorization server metadata', async () => {
      const response = await app.request('/.well-known/oauth-authorization-server')

      expect(response.status).toBe(200)
      const body = await response.json()

      // Verify metadata points to authorization server
      expect(body.issuer).toBe('https://auth.example.com/')
      expect(body.authorization_endpoint).toBe('https://auth.example.com/authorize')
      expect(body.token_endpoint).toBe('https://auth.example.com/token')
      expect(body.response_types_supported).toEqual(['code'])
      expect(body.grant_types_supported).toEqual(['authorization_code', 'refresh_token'])
      expect(body.code_challenge_methods_supported).toEqual(['S256'])
      expect(body.token_endpoint_auth_methods_supported).toEqual(['client_secret_post'])
    })

    it('returns OAuth protected resource metadata', async () => {
      const response = await app.request('/.well-known/oauth-protected-resource')

      expect(response.status).toBe(200)
      const body = await response.json()

      // Verify protected resource metadata
      expect(body.resource).toBe('https://api.example.com/')
      expect(body.authorization_servers).toEqual(['https://auth.example.com/'])
      expect(body.scopes_supported).toEqual(['read', 'write'])
      expect(body.resource_name).toBe('Test API')
      expect(body.resource_documentation).toBe('https://docs.example.com/')
    })

    it('works with minimal configuration', async () => {
      const minimalApp = new Hono()
      const options: AuthMetadataOptions = {
        oauthMetadata: mockOAuthMetadata,
        resourceServerUrl: new URL('https://api.example.com'),
      }
      minimalApp.route('/', wellKnownRouter(options))

      const authResponse = await minimalApp.request('/.well-known/oauth-authorization-server')

      const authResponseBody = await authResponse.json()

      expect(authResponse.status).toBe(200)
      expect(authResponseBody.issuer).toBe('https://auth.example.com/')
      expect(authResponseBody.service_documentation).toBeUndefined()
      expect(authResponseBody.scopes_supported).toBeUndefined()

      const resourceResponse = await minimalApp.request('/.well-known/oauth-protected-resource')
      const resourceResponseBody = await resourceResponse.json()

      expect(resourceResponse.status).toBe(200)
      expect(resourceResponseBody.resource).toBe('https://api.example.com/')
      expect(resourceResponseBody.authorization_servers).toEqual(['https://auth.example.com/'])
      expect(resourceResponseBody.scopes_supported).toBeUndefined()
      expect(resourceResponseBody.resource_name).toBeUndefined()
      expect(resourceResponseBody.resource_documentation).toBeUndefined()
    })
  })
})
