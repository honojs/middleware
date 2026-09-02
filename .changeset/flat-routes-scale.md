---
'@hono/zod-openapi': patch
---

Flatten batched route type inference so large `openapiRoutes` tuples do not hit TypeScript's recursive instantiation limit.
