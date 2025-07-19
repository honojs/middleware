import type { AuthRouterOptions } from '@modelcontextprotocol/sdk/server/auth/router.js'
import { Hono } from 'hono'
import { createOAuthMetadata, mcpAuthMetadataRouter } from './metadata'

export function mcpAuthRouter(options: AuthRouterOptions): Hono {
  const oauthMetadata = createOAuthMetadata(options)

  const router = new Hono()

  router.route(new URL(oauthMetadata.authorization_endpoint).pathname, dummyRouter)

  router.route(new URL(oauthMetadata.token_endpoint).pathname, dummyRouter)

  router.route(
    '/',
    mcpAuthMetadataRouter({
      oauthMetadata,
      // This router is used for AS+RS combo's, so the issuer is also the resource server
      resourceServerUrl: new URL(oauthMetadata.issuer),
      serviceDocumentationUrl: options.serviceDocumentationUrl,
      scopesSupported: options.scopesSupported,
      resourceName: options.resourceName,
    })
  )

  if (oauthMetadata.registration_endpoint) {
    router.route(new URL(oauthMetadata.registration_endpoint).pathname, dummyRouter)
  }

  if (oauthMetadata.revocation_endpoint) {
    router.route(new URL(oauthMetadata.revocation_endpoint).pathname, dummyRouter)
  }

  return router
}

const dummyRouter = new Hono()
