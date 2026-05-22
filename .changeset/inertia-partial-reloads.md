---
'@hono/inertia': minor
---

add server-side support for [Inertia.js partial reloads](https://inertiajs.com/partial-reloads). Honors the `X-Inertia-Partial-Component`, `X-Inertia-Partial-Data` (only), and `X-Inertia-Partial-Except` headers, and accepts function-valued props (`() => T | Promise<T>`) that are evaluated lazily — function props excluded from a partial reload are never invoked, so heavy data fetching can be skipped.
