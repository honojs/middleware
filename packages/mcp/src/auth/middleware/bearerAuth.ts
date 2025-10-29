import type { MiddlewareHandler } from 'hono'
import { bearerAuth as bearerAuthMiddleware } from './honoBearerAuth'
import type { BearerAuthOptions } from './honoBearerAuth'

export const bearerAuth = (options: BearerAuthOptions): MiddlewareHandler =>
  bearerAuthMiddleware({
    noAuthenticationHeader: {
      wwwAuthenticateHeader: (c) =>
        `Bearer error="Unauthorized", error_description="Unauthorized", resource_metadata="${new URL(c.req.url).origin}/.well-known/oauth-protected-resource"`,
    },
    invalidAuthenticationHeader: {
      wwwAuthenticateHeader: (c) =>
        `Bearer error="Unauthorized", error_description="Unauthorized", resource_metadata="${new URL(c.req.url).origin}/.well-known/oauth-protected-resource"`,
    },
    ...options,
  })
