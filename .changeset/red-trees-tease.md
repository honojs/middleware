---
'@hono/inertia': minor
---

fix(inertia): use the Referer for non-GET requests to keep the original URL

For non-GET requests, `page.url` now uses the `Referer` header (falling
back to `c.req.url`) instead of `c.req.url` to keep the original URL.

feat(inertia): add an option to override `page.url`

`c.render(component, props, options)` now accepts an optional third
argument `options?: RenderOptions` with a `url` field. Overrides `page.url`.
It is primarily used to prevent incorrect URLs when using no-referrer.

```ts
app.post('/users', (c) => c.render('Users/New', {}, { url: '/users/new' }))
```
