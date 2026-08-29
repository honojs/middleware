---
'@hono/inertia': patch
---

Rewrite `302` redirects to `303` for `PUT`, `PATCH`, and `DELETE` Inertia requests, so the client follows them with a `GET` instead of replaying the original method against the redirect target.
