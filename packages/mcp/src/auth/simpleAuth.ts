import type { Env, Hono, Schema } from 'hono'
import type { WellKnownRouterOptions } from './helpers'
import { wellKnownRouter } from './helpers'
import { createOAuthMetadata } from './router'

export type SimpleMcpAuthRouterOptions = {
  issuer: string | URL
} & Omit<WellKnownRouterOptions, 'oauthMetadata'>

export function simpleMcpAuthRouter<E extends Env, S extends Schema, P extends string>(
  options: SimpleMcpAuthRouterOptions
): Hono<E, S, P> {
  const { issuer, ...wellKnownOptions } = options

  return wellKnownRouter({
    oauthMetadata: createOAuthMetadata({
      issuerUrl: issuer,
      scopesSupported: wellKnownOptions.scopesSupported,
      serviceDocumentationUrl: wellKnownOptions.serviceDocumentationUrl,
    }),
    ...wellKnownOptions,
  })
}
