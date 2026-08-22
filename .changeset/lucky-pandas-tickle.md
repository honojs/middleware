---
'@hono/oauth-providers': minor
---

Add an OpenStreetMap OAuth 2.0 provider, available as `@hono/oauth-providers/openstreetmap`. The
flow always uses PKCE with the `S256` challenge method, and `revokeToken` is exported to invalidate
tokens, which OpenStreetMap never expires on its own.
