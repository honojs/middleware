---
'@hono/oidc-auth': minor
---

Fix Google login failing with `OAuth2Error: [invalid_client] The OAuth client was not found`. `oauth4webapi` v3 percent-encodes the client id/secret for `client_secret_basic` per RFC 6749 Appendix B, but Google does not decode that encoding and rejects the resulting credentials when they contain `-`, `_` or `.`.

Add `setClientAuth()` to let consumers opt in to `client_secret_post` for the token endpoint requests (authorization code exchange, refresh, revocation), which sends the client secret unencoded in the request body. Also add `setClient()` to set the OAuth2 client metadata directly. The default `token_endpoint_auth_method` remains `client_secret_basic`, so existing consumers are unaffected; only clients whose secret contains `-`, `_` or `.` need to call `setClientAuth(c, oauth2.ClientSecretPost(env.OIDC_CLIENT_SECRET))`.
