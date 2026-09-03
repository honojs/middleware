---
'@hono/zod-openapi': patch
---

fix: return 415 when a JSON or form request body's Content-Type matches none of the route's declared media types, instead of validating an empty object
