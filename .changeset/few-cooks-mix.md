---
'@hono/zod-openapi': patch
---

Revert the local z binding export because it causes zod types to degrade to any when built with tsdown.
