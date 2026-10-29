---
'@hono/zod-validator': patch
'@hono/valibot-validator': patch
---

Include the default JSON 400 response in inferred types when a validation hook can return void or undefined. Return MiddlewareHandler from Valibot so Hono preserves its response types.
