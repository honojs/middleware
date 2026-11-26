---
'@hono/casbin': patch
---

fix(casbin): `jwtAuthorizer` uses only the payload that the JWT middleware of `hono/jwt` has verified. It no longer decodes the `Authorization` header by itself, so it denies the request when `jwt()` is not used before `casbin()`.
