---
'@hono/zod-openapi': patch
---

fix: change middleware type from MiddlewareHandler to H

Update RouteConfig middleware field type to use H (Handler | MiddlewareHandler union) instead of MiddlewareHandler. This aligns with Hono's on() method type expectations and resolves type errors introduced in Hono v4.10.0+.

The H type is the correct type for handlers passed to Hono's on() method, and this change maintains runtime compatibility while fixing TypeScript compilation errors.
