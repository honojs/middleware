import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js'
import type {
  OAuthClientInformationFull,
  OAuthClientMetadata,
} from '@modelcontextprotocol/sdk/shared/auth.js'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { clientRegistrationHandler } from './register.js'
import type { ClientRegistrationHandlerOptions } from './register.js'

describe('Client Registration Handler', () => {
  // Mock client store with registration support
  const mockClientStoreWithRegistration: OAuthRegisteredClientsStore = {
    async getClient(_clientId: string): Promise<OAuthClientInformationFull | undefined> {
      return undefined
    },

    async registerClient(client: OAuthClientInformationFull): Promise<OAuthClientInformationFull> {
      // Return the client info as-is in the mock
      return client
    },
  }

  // Mock client store without registration support
  const mockClientStoreWithoutRegistration: OAuthRegisteredClientsStore = {
    async getClient(_clientId: string): Promise<OAuthClientInformationFull | undefined> {
      return undefined
    },
    // No registerClient method
  }

  describe('Handler creation', () => {
    it('throws error if client store does not support registration', () => {
      const options: ClientRegistrationHandlerOptions = {
        clientsStore: mockClientStoreWithoutRegistration,
      }

      expect(() => clientRegistrationHandler(options)).toThrow(
        'does not support registering clients'
      )
    })

    it('creates handler if client store supports registration', () => {
      const options: ClientRegistrationHandlerOptions = {
        clientsStore: mockClientStoreWithRegistration,
      }

      expect(() => clientRegistrationHandler(options)).not.toThrow()
    })
  })

  describe('Request handling', () => {
    let app: Hono
    let spyRegisterClient: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      // Setup express app with registration handler
      app = new Hono()
      const options: ClientRegistrationHandlerOptions = {
        clientsStore: mockClientStoreWithRegistration,
        clientSecretExpirySeconds: 86400, // 1 day for testing
      }

      app.post('/register', cors(), clientRegistrationHandler(options))

      // Spy on the registerClient method
      spyRegisterClient = vi.spyOn(mockClientStoreWithRegistration, 'registerClient')
    })

    afterEach(() => {
      spyRegisterClient.mockRestore()
    })

    it('validates required client metadata', async () => {
      const response = await app.request('/register', {
        method: 'POST',
        body: JSON.stringify({
          // Missing redirect_uris (required)
          client_name: 'Test Client',
        }),
      })

      expect(response.status).toBe(400)
      const body = await response.json()

      expect(body.error).toBe('invalid_client_metadata')
      expect(spyRegisterClient).not.toHaveBeenCalled()
    })

    it('validates redirect URIs format', async () => {
      const response = await app.request('/register', {
        method: 'POST',
        body: JSON.stringify({
          redirect_uris: ['invalid-url'], // Invalid URL format
        }),
      })

      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toBe('invalid_client_metadata')
      expect(body.error_description).toContain('redirect_uris')
      expect(spyRegisterClient).not.toHaveBeenCalled()
    })

    it('successfully registers client with minimal metadata', async () => {
      const clientMetadata: OAuthClientMetadata = {
        redirect_uris: ['https://example.com/callback'],
      }

      const response = await app.request('/register', {
        method: 'POST',
        body: JSON.stringify(clientMetadata),
      })

      expect(response.status).toBe(201)

      const body = await response.json()

      // Verify the generated client information
      expect(body.client_id).toBeDefined()
      expect(body.client_secret).toBeDefined()
      expect(body.client_id_issued_at).toBeDefined()
      expect(body.client_secret_expires_at).toBeDefined()
      expect(body.redirect_uris).toEqual(['https://example.com/callback'])

      // Verify client was registered
      expect(spyRegisterClient).toHaveBeenCalledTimes(1)
    })

    it('sets client_secret to undefined for token_endpoint_auth_method=none', async () => {
      const clientMetadata: OAuthClientMetadata = {
        redirect_uris: ['https://example.com/callback'],
        token_endpoint_auth_method: 'none',
      }

      const response = await app.request('/register', {
        method: 'POST',
        body: JSON.stringify(clientMetadata),
      })

      const body = await response.json()

      expect(response.status).toBe(201)
      expect(body.client_secret).toBeUndefined()
      expect(body.client_secret_expires_at).toBeUndefined()
    })

    it('sets client_secret_expires_at for public clients only', async () => {
      // Test for public client (token_endpoint_auth_method not 'none')
      const publicClientMetadata: OAuthClientMetadata = {
        redirect_uris: ['https://example.com/callback'],
        token_endpoint_auth_method: 'client_secret_basic',
      }

      const publicResponse = await app.request('/register', {
        method: 'POST',
        body: JSON.stringify(publicClientMetadata),
      })

      const publicBody = await publicResponse.json()

      expect(publicResponse.status).toBe(201)
      expect(publicBody.client_secret).toBeDefined()
      expect(publicBody.client_secret_expires_at).toBeDefined()

      // Test for non-public client (token_endpoint_auth_method is 'none')
      const nonPublicClientMetadata: OAuthClientMetadata = {
        redirect_uris: ['https://example.com/callback'],
        token_endpoint_auth_method: 'none',
      }

      const nonPublicResponse = await app.request('/register', {
        method: 'POST',
        body: JSON.stringify(nonPublicClientMetadata),
      })

      const nonPublicBody = await nonPublicResponse.json()

      expect(nonPublicResponse.status).toBe(201)
      expect(nonPublicBody.client_secret).toBeUndefined()
      expect(nonPublicBody.client_secret_expires_at).toBeUndefined()
    })

    it('sets expiry based on clientSecretExpirySeconds', async () => {
      // Create handler with custom expiry time
      const customApp = new Hono()
      const options: ClientRegistrationHandlerOptions = {
        clientsStore: mockClientStoreWithRegistration,
        clientSecretExpirySeconds: 3600, // 1 hour
      }

      customApp.post('/register', clientRegistrationHandler(options))

      const response = await customApp.request('/register', {
        method: 'POST',
        body: JSON.stringify({
          redirect_uris: ['https://example.com/callback'],
        }),
      })

      const body = await response.json()

      expect(response.status).toBe(201)

      // Verify the expiration time (~1 hour from now)
      const issuedAt = body.client_id_issued_at
      const expiresAt = body.client_secret_expires_at
      expect(expiresAt - issuedAt).toBe(3600)
    })

    it('sets no expiry when clientSecretExpirySeconds=0', async () => {
      // Create handler with no expiry
      const customApp = new Hono()
      const options: ClientRegistrationHandlerOptions = {
        clientsStore: mockClientStoreWithRegistration,
        clientSecretExpirySeconds: 0, // No expiry
      }

      customApp.post('/register', clientRegistrationHandler(options))

      const response = await customApp.request('/register', {
        method: 'POST',
        body: JSON.stringify({
          redirect_uris: ['https://example.com/callback'],
        }),
      })

      const body = await response.json()

      expect(response.status).toBe(201)
      expect(body.client_secret_expires_at).toBe(0)
    })

    it('sets no client_id when clientIdGeneration=false', async () => {
      // Create handler with no expiry
      const customApp = new Hono()
      const options: ClientRegistrationHandlerOptions = {
        clientsStore: mockClientStoreWithRegistration,
        clientIdGeneration: false,
      }

      customApp.post('/register', clientRegistrationHandler(options))

      const response = await customApp.request('/register', {
        method: 'POST',
        body: JSON.stringify({
          redirect_uris: ['https://example.com/callback'],
        }),
      })

      const body = await response.json()

      expect(response.status).toBe(201)
      expect(body.client_id).toBeUndefined()
      expect(body.client_id_issued_at).toBeUndefined()
    })

    it('handles client with all metadata fields', async () => {
      const fullClientMetadata: OAuthClientMetadata = {
        redirect_uris: ['https://example.com/callback'],
        token_endpoint_auth_method: 'client_secret_basic',
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        client_name: 'Test Client',
        client_uri: 'https://example.com',
        logo_uri: 'https://example.com/logo.png',
        scope: 'profile email',
        contacts: ['dev@example.com'],
        tos_uri: 'https://example.com/tos',
        policy_uri: 'https://example.com/privacy',
        jwks_uri: 'https://example.com/jwks',
        software_id: 'test-software',
        software_version: '1.0.0',
      }

      const response = await app.request('/register', {
        method: 'POST',
        body: JSON.stringify(fullClientMetadata),
      })

      const body = await response.json()

      expect(response.status).toBe(201)

      // Verify all metadata was preserved
      Object.entries(fullClientMetadata).forEach(([key, value]) => {
        expect(body[key]).toEqual(value)
      })
    })

    it('includes CORS headers in response', async () => {
      const response = await app.request('/register', {
        method: 'POST',
        headers: {
          Origin: 'https://example.com',
        },
        body: JSON.stringify({
          redirect_uris: ['https://example.com/callback'],
        }),
      })

      expect(response.headers.get('access-control-allow-origin')).toBe('*')
    })
  })
})
