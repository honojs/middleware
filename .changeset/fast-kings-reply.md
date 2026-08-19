---
'@hono/inertia': patch
---

Normalize the props resolved by `PageProps`: renders without props now resolve to `{}`, and when the same page is rendered with and without props by different handlers, the props are made optional.