---
'@hono/zod-openapi': patch
---

fix(zod-openapi): preserve `onError()`/`notFound()` set after `basePath()`

`OpenAPIHono.basePath()` used to rebuild the instance by spreading the plain `Hono` clone returned by `super.basePath()`.
That spread copied the clone's arrow-function instance fields (`onError`, `notFound`, `request`, `fetch`),
which stay bound to the discarded clone — so calling `.onError()` (or `.notFound()`) *after* `.basePath()` mutated the throwaway clone instead of the returned app and silently had no effect (the parent's handler ran instead).
`basePath()` now transplants only the routing state onto a properly constructed `OpenAPIHono`, keeping its own correctly-bound methods. Fixes #2021.
