---
'@hono/inertia': minor
---

feat(inertia): add shared props through a `share` callback

Shared props are combined with page props, with page props taking precedence when keys overlap. They are processed in the same way as props passed to `c.render()` and included in `PageProps` type inference. Their top-level keys are exposed through `sharedProps` page metadata.

fix(inertia): correct the `c.render()` return type

Change the return type of `c.render()` to `Response | Promise<Response>` so it correctly represents render results that involve asynchronous work.
