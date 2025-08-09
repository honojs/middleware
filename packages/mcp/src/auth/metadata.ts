import type { OAuthServerProvider } from '@modelcontextprotocol/sdk/server/auth/provider.js'
import type { AuthMetadataOptions } from '@modelcontextprotocol/sdk/server/auth/router.js'
import type {
  OAuthMetadata,
  OAuthProtectedResourceMetadata,
} from '@modelcontextprotocol/sdk/shared/auth.js'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { checkIssuerUrl } from './utils'

export function createOAuthMetadata(options: {
  provider: OAuthServerProvider
  issuerUrl: URL
  baseUrl?: URL
  serviceDocumentationUrl?: URL
  scopesSupported?: string[]
}): OAuthMetadata {
  const issuer = options.issuerUrl
  const baseUrl = options.baseUrl

  checkIssuerUrl(issuer)

  const authorization_endpoint = '/authorize'
  const token_endpoint = '/token'
  const registration_endpoint = options.provider.clientsStore.registerClient
    ? '/register'
    : undefined
  const revocation_endpoint = options.provider.revokeToken ? '/revoke' : undefined

  const metadata: OAuthMetadata = {
    issuer: issuer.href,
    service_documentation: options.serviceDocumentationUrl?.href,

    authorization_endpoint: new URL(authorization_endpoint, baseUrl || issuer).href,
    response_types_supported: ['code'],
    code_challenge_methods_supported: ['S256'],

    token_endpoint: new URL(token_endpoint, baseUrl || issuer).href,
    token_endpoint_auth_methods_supported: ['client_secret_post'],
    grant_types_supported: ['authorization_code', 'refresh_token'],

    scopes_supported: options.scopesSupported,

    revocation_endpoint: revocation_endpoint
      ? new URL(revocation_endpoint, baseUrl || issuer).href
      : undefined,
    revocation_endpoint_auth_methods_supported: revocation_endpoint
      ? ['client_secret_post']
      : undefined,

    registration_endpoint: registration_endpoint
      ? new URL(registration_endpoint, baseUrl || issuer).href
      : undefined,
  }

  return metadata
}

export function mcpAuthMetadataRouter(options: AuthMetadataOptions): Hono {
  checkIssuerUrl(new URL(options.oauthMetadata.issuer))

  const router = new Hono().basePath('/.well-known')

  const protectedResourceMetadata: OAuthProtectedResourceMetadata = {
    resource: options.resourceServerUrl.href,

    authorization_servers: [options.oauthMetadata.issuer],

    scopes_supported: options.scopesSupported,
    resource_name: options.resourceName,
    resource_documentation: options.serviceDocumentationUrl?.href,
  }

  // Configure CORS to allow any origin, to make accessible to web-based MCP clients
  router.use(cors())

  router.get('/oauth-protected-resource', (c) => c.json(protectedResourceMetadata))

  // Always add this for backwards compatibility
  router.get('/oauth-authorization-server', (c) => c.json(options.oauthMetadata))

  return router
}
