import type { MiddlewareHandler } from 'hono'
import { bearerAuth as bearerAuthMiddleware } from 'hono/bearer-auth'

export const bearerAuth = (
  options: Parameters<typeof bearerAuthMiddleware>[0]
): MiddlewareHandler =>
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
