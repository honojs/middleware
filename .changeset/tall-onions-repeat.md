---
'@hono/inertia': minor
---

Add `always()` to mark a prop as always included. Props wrapped with it bypass both the `X-Inertia-Partial-Data` and `X-Inertia-Partial-Except` filters, so cross-cutting props such as validation errors or flash messages survive a partial reload. Mirrors `Inertia::always()` in `inertia-laravel`.
