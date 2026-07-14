---
'@hono/zod-openapi': minor
---

feat: inherit `defaultHook` from parent app on nested routes mounted via `app.route()`

Behavior change: if a parent app has a `defaultHook` and a mounted sub-app does not declare its own, the sub-app's routes now use the parent's `defaultHook` instead of the built-in validation response.
