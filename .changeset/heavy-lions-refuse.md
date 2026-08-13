---
'@hono/zod-openapi': minor
---

fix: return 415 when a request body's Content-Type matches none of the route's declared media types, instead of skipping validation
