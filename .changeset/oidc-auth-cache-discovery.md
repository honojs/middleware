---
'@hono/oidc-auth': patch
---

Reuse the OIDC discovery document across requests, keyed by issuer, for `OIDC_DISCOVERY_CACHE_TTL` seconds (default 1 hour, `0` disables)
