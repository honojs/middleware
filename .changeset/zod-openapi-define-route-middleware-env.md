---
'@hono/zod-openapi': patch
---

`defineOpenAPIRoute` now infers handler `Env` (Variables/Bindings) from the route's `middleware`, matching `OpenAPIHono.openapi()` behavior.
