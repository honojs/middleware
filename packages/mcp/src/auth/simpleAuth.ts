import type { Hono } from 'hono'
import type { WellKnownRouterOptions } from './helpers'
import { checkIssuerUrl, wellKnownRouter } from './helpers'

export type SimpleMcpAuthRouterOptions = {
  issuer: string
} & Omit<WellKnownRouterOptions, 'oauthMetadata'>

export function simpleMcpAuthRouter(options: SimpleMcpAuthRouterOptions): Hono {
  const { issuer, ...wellKnownOptions } = options

  const _issuer = new URL(issuer)
  checkIssuerUrl(_issuer)

  return wellKnownRouter({
    oauthMetadata: {
      issuer: _issuer.href,
      service_documentation: wellKnownOptions.serviceDocumentationUrl?.href,

      authorization_endpoint: new URL('/authorize', issuer).href,
      response_types_supported: ['code'],
      code_challenge_methods_supported: ['S256'],

      token_endpoint: new URL('/token', issuer).href,
      token_endpoint_auth_methods_supported: ['client_secret_post'],
      grant_types_supported: ['authorization_code', 'refresh_token'],

      scopes_supported: wellKnownOptions.scopesSupported,
    },
    ...wellKnownOptions,
  })
}
