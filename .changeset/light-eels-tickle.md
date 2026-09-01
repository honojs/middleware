---
'@hono/inertia': patch
---

fix(inertia): send redirects with a URL fragment as an Inertia location, and always set `Vary: X-Inertia`

A browser follows a redirect without sending the fragment to the server, so `c.redirect('/users#profile')` lost `#profile`. Inertia requests now get a `409` with `X-Inertia-Redirect` so the client navigates in JavaScript, where the fragment survives. Prefetch requests are exempt. `Vary: X-Inertia` is now set on every response, not just the ones that went through `c.render`.
