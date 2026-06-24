---
'@hono/inertia': minor
---

feat(inertia): add an option to override `page.url`

`c.render(component, props, options)` now accepts an optional third argument
`options?: RenderOptions` with a `url` field. Overrides `page.url`. It is primarily
used to prevent incorrect URLs when using no-referrer, origin, or strict-origin.

```ts
app.post('/users', (c) => c.render('Users/New', {}, { url: '/users/new' }))
```
