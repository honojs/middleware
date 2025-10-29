import type { Hono } from 'hono'
import { wellKnownRouter } from './helpers'

export type SimpleMcpAuthRouterOptions = {
  issuer: string
  resourceServerUrl: URL
}

export function simpleMcpAuthRouter(options: SimpleMcpAuthRouterOptions): Hono {
  return wellKnownRouter({
    resourceServerUrl: options.resourceServerUrl,
    oauthMetadata: {
      issuer: options.issuer,
      service_documentation: undefined,

      authorization_endpoint: new URL('/authorize', options.issuer).href,
      response_types_supported: ['code'],
      code_challenge_methods_supported: ['S256'],

      token_endpoint: new URL('/token', options.issuer).href,
      token_endpoint_auth_methods_supported: ['client_secret_post'],
      grant_types_supported: ['authorization_code', 'refresh_token'],

      scopes_supported: undefined,
    },
  })
}
