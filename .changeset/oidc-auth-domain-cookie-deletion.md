---
"@hono/oidc-auth": patch
---

Delete the domain-scoped session cookie on every invalidation path, not only in `revokeSession()`. When `OIDC_COOKIE_DOMAIN` is configured the session cookie is stored domain-scoped, but `getAuth()` (invalid JWT, empty refresh token, rejected refresh grant), the `oidcAuthMiddleware()` catch block, the OAuth flow-cookie cleanup in `processOAuthCallback()`, and the session-cookie re-set after `next()` all dropped the `Domain` attribute. A cookie's identity is its (name, domain, path) triple, so the domain-scoped cookie survived invalidation and the session stayed alive; the re-set also created a divergent host-only cookie. All invalidation paths now share the delete-both behaviour `revokeSession()` already had (#1490).
