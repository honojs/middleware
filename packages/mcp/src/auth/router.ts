import { TooManyRequestsError } from '@modelcontextprotocol/sdk/server/auth/errors.js'
import type { OAuthServerProvider } from '@modelcontextprotocol/sdk/server/auth/provider.js'
import type { OAuthMetadata } from '@modelcontextprotocol/sdk/shared/auth.js'
import type { MiddlewareHandler } from 'hono'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { ConfigType as RateLimitOptions } from 'hono-rate-limiter'
import { rateLimiter } from 'hono-rate-limiter'
import {
  authorizeHandler,
  checkIssuerUrl,
  clientRegistrationHandler,
  revokeHandler,
  tokenHandler,
} from './helpers'
import { wellKnownRouter } from './helpers/wellknown'
import { authenticateClient } from './middleware/client-auth'

export type AuthRouterOptions = {
  /**
   * A provider implementing the actual authorization logic for this router.
   */
  provider: OAuthServerProvider

  /**
   * The authorization server's issuer identifier, which is a URL that uses the "https" scheme and has no query or fragment components.
   */
  issuerUrl: URL

  /**
   * The base URL of the authorization server to use for the metadata endpoints.
   *
   * If not provided, the issuer URL will be used as the base URL.
   */
  baseUrl?: URL

  /**
   * An optional URL of a page containing human-readable information that developers might want or need to know when using the authorization server.
   */
  serviceDocumentationUrl?: URL

  /**
   * An optional list of scopes supported by this authorization server
   */
  scopesSupported?: string[]

  /**
   * The resource name to be displayed in protected resource metadata
   */
  resourceName?: string

  // Individual options per route
  authorizationOptions?: {
    rateLimit?: Partial<RateLimitOptions> | false
  }
  clientRegistrationOptions?: {
    rateLimit?: Partial<RateLimitOptions> | false
    clientIdGeneration?: boolean
    clientSecretExpirySeconds?: number
  }
  revocationOptions?: {
    rateLimit?: Partial<RateLimitOptions> | false
  }
  tokenOptions?: {
    rateLimit?: Partial<RateLimitOptions> | false
  }
}

export const createOAuthMetadata = (options: {
  provider: OAuthServerProvider
  issuerUrl: URL
  baseUrl?: URL
  serviceDocumentationUrl?: URL
  scopesSupported?: string[]
}): OAuthMetadata => {
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

/**
 * Installs standard MCP authorization server endpoints, including dynamic client registration and token revocation (if supported).
 * Also advertises standard authorization server metadata, for easier discovery of supported configurations by clients.
 * Note: if your MCP server is only a resource server and not an authorization server, use mcpAuthMetadataRouter instead.
 *
 * By default, rate limiting is applied to all endpoints to prevent abuse.
 *
 * This router MUST be installed at the application root, like so:
 *
 *  const app = new Hono();
 *  app.route("/", mcpAuthRouter(...));
 */
export function mcpAuthRouter(options: AuthRouterOptions): Hono {
  const oauthMetadata = createOAuthMetadata(options)

  const router = new Hono().use(cors())

  router.on(
    ['GET', 'POST'],
    new URL(oauthMetadata.authorization_endpoint).pathname,
    applyRateLimiter(options.authorizationOptions?.rateLimit, {
      windowMs: 15 * 60 * 1000, // 15 minutes
      limit: 100, // 100 requests per windowMs
      standardHeaders: true,
      keyGenerator: () => 'some-unique-key',
      message: new TooManyRequestsError(
        'You have exceeded the rate limit for token requests'
      ).toResponseObject(),
    }),
    authorizeHandler(options.provider)
  )

  const authenticateClientMiddleware = authenticateClient({
    clientsStore: options.provider.clientsStore,
  })

  router.post(
    new URL(oauthMetadata.token_endpoint).pathname,
    applyRateLimiter(options.tokenOptions?.rateLimit, {
      windowMs: 15 * 60 * 1000, // 15 minutes
      limit: 50, // 50 requests per windowMs
      standardHeaders: true,
      keyGenerator: () => 'some-unique-key',
      message: new TooManyRequestsError(
        'You have exceeded the rate limit for token requests'
      ).toResponseObject(),
    }),
    authenticateClientMiddleware,
    tokenHandler(options.provider)
  )

  router.route(
    '/',
    wellKnownRouter({
      oauthMetadata,
      // This router is used for AS+RS combo's, so the issuer is also the resource server
      resourceServerUrl: new URL(oauthMetadata.issuer),
      serviceDocumentationUrl: options.serviceDocumentationUrl,
      scopesSupported: options.scopesSupported,
      resourceName: options.resourceName,
    })
  )

  if (oauthMetadata.registration_endpoint) {
    router.post(
      new URL(oauthMetadata.registration_endpoint).pathname,
      applyRateLimiter(options.clientRegistrationOptions?.rateLimit, {
        windowMs: 60 * 60 * 1000, // 1 hour
        limit: 20, // 20 requests per windowMs
        standardHeaders: true,
        keyGenerator: () => 'some-unique-key',
        message: new TooManyRequestsError(
          'You have exceeded the rate limit for client registration requests'
        ).toResponseObject(),
      }),
      clientRegistrationHandler({
        clientsStore: options.provider.clientsStore,
        clientIdGeneration: options.clientRegistrationOptions?.clientIdGeneration,
        clientSecretExpirySeconds: options.clientRegistrationOptions?.clientSecretExpirySeconds,
      })
    )
  }

  if (oauthMetadata.revocation_endpoint) {
    router.post(
      new URL(oauthMetadata.revocation_endpoint).pathname,
      applyRateLimiter(options.revocationOptions?.rateLimit, {
        windowMs: 15 * 60 * 1000, // 15 minutes
        limit: 50, // 50 requests per windowMs
        standardHeaders: true,
        keyGenerator: () => 'some-unique-key',
        message: new TooManyRequestsError(
          'You have exceeded the rate limit for token revocation requests'
        ).toResponseObject(),
      }),
      authenticateClientMiddleware,
      revokeHandler(options.provider)
    )
  }

  return router
}

function applyRateLimiter(
  options: Partial<RateLimitOptions> | undefined | false,
  defaultOptions: Partial<RateLimitOptions>
): MiddlewareHandler {
  if (options === false) {
    return (_c, next) => next()
  }

  return rateLimiter({
    ...defaultOptions,
    ...options,
  } as RateLimitOptions)
}
