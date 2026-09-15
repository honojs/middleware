---
'@hono/zod-openapi': patch
---

fix: type `defaultHook` in `OpenAPIHonoOptions` with `unknown`, `string` and `Response | void` instead of `any`, so the hook's context is inferred from the instance's `Env` rather than collapsing to `Context<any, any>`
