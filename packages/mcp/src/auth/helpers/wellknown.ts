import type {
  OAuthMetadata,
  OAuthProtectedResourceMetadata,
} from '@modelcontextprotocol/sdk/shared/auth.js'
import type { Env, Schema } from 'hono'
import { Hono } from 'hono'
import { checkIssuerUrl } from './utils'

export type WellKnownRouterOptions = {
  /**
   * OAuth Metadata as would be returned from the authorization server
   * this MCP server relies on
   */
  oauthMetadata: OAuthMetadata

  /**
   * The url of the MCP server, for use in protected resource metadata
   */
  resourceServerUrl: URL

  /**
   * The url for documentation for the MCP server
   */
  serviceDocumentationUrl?: URL

  /**
   * An optional list of scopes supported by this MCP server
   */
  scopesSupported?: string[]

  /**
   * An optional resource name to display in resource metadata
   */
  resourceName?: string
}

export function wellKnownRouter<E extends Env, S extends Schema, P extends string>(options: WellKnownRouterOptions): Hono<E, S, P> {
  checkIssuerUrl(new URL(options.oauthMetadata.issuer))

  const router = new Hono<E, S, P>().basePath('/.well-known')

  const protectedResourceMetadata: OAuthProtectedResourceMetadata = {
    resource: options.resourceServerUrl.href,

    authorization_servers: [options.oauthMetadata.issuer],

    scopes_supported: options.scopesSupported,
    resource_name: options.resourceName,
    resource_documentation: options.serviceDocumentationUrl?.href,
  }

  // Serve PRM at the path-specific URL per RFC 9728
  const rsPath = new URL(options.resourceServerUrl.href).pathname
  router.get(`/oauth-protected-resource${rsPath === '/' ? '' : rsPath}`, (c) =>
    c.json(protectedResourceMetadata)
  )

  // Always add this for backwards compatibility
  router.get('/oauth-authorization-server', (c) => c.json(options.oauthMetadata))

  return router
}
