---
"@hono/zod-openapi": minor
---

Add optional outgoing response validation via `strictStatusCode` and `strictResponse` on `OpenAPIHono`, with `defaultResponseHook` and per-route `responseHook` for failures. Validation runs when handlers use `c.json` (see README for scope).
