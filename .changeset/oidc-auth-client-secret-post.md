---
'@hono/oidc-auth': patch
---

Fix Google login failing with `OAuth2Error: [invalid_client] The OAuth client was not found`. `oauth4webapi` v3 percent-encodes the client id/secret for `client_secret_basic` per RFC 6749 Appendix B, but Google does not decode that encoding and rejects the resulting credentials when they contain `-`, `_` or `.`. Switch the token endpoint requests (authorization code exchange, refresh, revocation) to `client_secret_post`, which sends the client secret unencoded in the request body.
