import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js'
import type { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js'
import { Hono } from 'hono'
import { authenticateClient } from './client-auth.js'
import type { ClientAuthenticationMiddlewareOptions } from './client-auth.js'

describe('clientAuth middleware', () => {
  // Mock client store
  const mockClientStore: OAuthRegisteredClientsStore = {
    async getClient(clientId: string): Promise<OAuthClientInformationFull | undefined> {
      if (clientId === 'valid-client') {
        return {
          client_id: 'valid-client',
          client_secret: 'valid-secret',
          redirect_uris: ['https://example.com/callback'],
        }
      } else if (clientId === 'expired-client') {
        // Client with no secret
        return {
          client_id: 'expired-client',
          redirect_uris: ['https://example.com/callback'],
        }
      } else if (clientId === 'client-with-expired-secret') {
        // Client with an expired secret
        return {
          client_id: 'client-with-expired-secret',
          client_secret: 'expired-secret',
          client_secret_expires_at: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
          redirect_uris: ['https://example.com/callback'],
        }
      }
      return undefined
    },
  }

  // Setup Express app with middleware
  let app: Hono
  let options: ClientAuthenticationMiddlewareOptions

  beforeEach(() => {
    app = new Hono()

    options = {
      clientsStore: mockClientStore,
    }

    // Setup route with client auth
    app.post('/protected', authenticateClient(options), (c) => {
      return c.json({ success: true, client: c.get('client') })
    })
  })

  it('authenticates valid client credentials', async () => {
    const response = await app.request('/protected', {
      method: 'POST',
      body: JSON.stringify({
        client_id: 'valid-client',
        client_secret: 'valid-secret',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.client.client_id).toBe('valid-client')
  })

  it('rejects invalid client_id', async () => {
    const response = await app.request('/protected', {
      method: 'POST',
      body: JSON.stringify({
        client_id: 'non-existent-client',
        client_secret: 'some-secret',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    })

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('invalid_client')
    expect(body.error_description).toBe('Invalid client_id')
  })

  it('rejects invalid client_secret', async () => {
    const response = await app.request('/protected', {
      method: 'POST',
      body: JSON.stringify({
        client_id: 'valid-client',
        client_secret: 'wrong-secret',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    })

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('invalid_client')
    expect(body.error_description).toBe('Invalid client_secret')
  })

  it('rejects missing client_id', async () => {
    const response = await app.request('/protected', {
      method: 'POST',
      body: JSON.stringify({
        client_secret: 'valid-secret',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    })

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('invalid_request')
  })

  it('allows missing client_secret if client has none', async () => {
    const response = await app.request('/protected', {
      method: 'POST',
      body: JSON.stringify({
        client_id: 'expired-client',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Since the client has no secret, this should pass without providing one
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.client.client_id).toBe('expired-client')
  })

  it('rejects request when client secret has expired', async () => {
    const response = await app.request('/protected', {
      method: 'POST',
      body: JSON.stringify({
        client_id: 'client-with-expired-secret',
        client_secret: 'expired-secret',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    })

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('invalid_client')
    expect(body.error_description).toBe('Client secret has expired')
  })

  it('handles malformed request body', async () => {
    const response = await app.request('/protected', {
      method: 'POST',
      body: 'not-json-format',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    expect(response.status).toBe(500)
  })

  // Testing request with extra fields to ensure they're ignored
  it('ignores extra fields in request', async () => {
    const response = await app.request('/protected', {
      method: 'POST',
      body: JSON.stringify({
        client_id: 'valid-client',
        client_secret: 'valid-secret',
        extra_field: 'should be ignored',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    })

    expect(response.status).toBe(200)
  })
})
