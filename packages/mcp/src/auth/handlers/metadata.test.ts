import type { OAuthMetadata } from '@modelcontextprotocol/sdk/shared/auth.js';
import { Hono } from 'hono';
import { metadataHandler } from './metadata.js';

describe('Metadata Handler', () => {
  const exampleMetadata: OAuthMetadata = {
    issuer: 'https://auth.example.com',
    authorization_endpoint: 'https://auth.example.com/authorize',
    token_endpoint: 'https://auth.example.com/token',
    registration_endpoint: 'https://auth.example.com/register',
    revocation_endpoint: 'https://auth.example.com/revoke',
    scopes_supported: ['profile', 'email'],
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['client_secret_basic'],
    code_challenge_methods_supported: ['S256']
  };

  let app: Hono;

  beforeEach(() => {
    // Setup express app with metadata handler
    app = new Hono();
    app.route('/.well-known/oauth-authorization-server', metadataHandler(exampleMetadata));
  });

  it('requires GET method', async () => {
    const response = await app
      .request('/.well-known/oauth-authorization-server', {
        method: 'POST',
        body: JSON.stringify({})
      });

    expect(response.status).toBe(404);
    expect(await response.text()).toEqual("404 Not Found");
  });

  it('returns the metadata object', async () => {
    const response = await app
      .request('/.well-known/oauth-authorization-server');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(exampleMetadata);
  });

  it('includes CORS headers in response', async () => {
    const response = await app
      .request('/.well-known/oauth-authorization-server', {
        headers: {
          Origin: 'https://example.com'
        }
      });

    expect(response.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('supports OPTIONS preflight requests', async () => {
    const response = await app
      .request('/.well-known/oauth-authorization-server', {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://example.com',
          'Access-Control-Request-Method': 'GET'
        }
      });

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('works with minimal metadata', async () => {
    // Setup a new express app with minimal metadata
    const minimalApp = new Hono();
    const minimalMetadata: OAuthMetadata = {
      issuer: 'https://auth.example.com',
      authorization_endpoint: 'https://auth.example.com/authorize',
      token_endpoint: 'https://auth.example.com/token',
      response_types_supported: ['code']
    };
    minimalApp.route('/.well-known/oauth-authorization-server', metadataHandler(minimalMetadata));

    const response = await minimalApp
      .request('/.well-known/oauth-authorization-server');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(minimalMetadata);
  });
});