---
'@hono/standard-validator': patch
'@hono/valibot-validator': patch
---

Fixed the error handling in the validation middleware to respect the type of `Response` returned by the hook.
