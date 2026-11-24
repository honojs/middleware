---
'@hono/zod-openapi': patch
---

Allow an async validation hook to return nothing on success. The `hook` of `app.openapi()` and `defineOpenAPIRoute()` and the `RouteHook` type now accept a `Promise` that resolves to a response or `undefined`
