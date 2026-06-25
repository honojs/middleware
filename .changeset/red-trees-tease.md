---
'@hono/inertia': minor
---

fix(inertia): use the Referer for non-GET requests to keep the original URL

**Behavior change**: For non-GET requests, `page.url` previously used
`c.req.url` (e.g. the POST target). It now uses the `Referer` header
(falling back to `c.req.url` when unavailable). If you were relying on
the old value, pass the explicit `options.url` instead.
