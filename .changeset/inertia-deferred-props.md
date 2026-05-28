---
'@hono/inertia': minor
---

feat(inertia): add deferred props with `defer()`

Adds a `defer(resolver, group?)` helper that defers a prop until after the
initial render. On the initial response the resolver is skipped and the
prop key is advertised via `page.deferredProps[group]`; the Inertia client
then issues one partial reload per group, at which point the resolver runs
and the value is sent down.

```ts
import { defer, inertia } from '@hono/inertia'

app.use(inertia())

app.get('/', (c) =>
  c.render('Dashboard', {
    user: { id: 1 },                       // sent on initial response
    posts: defer(() => fetchPosts()),      // fetched after mount
    stats: defer(() => fetchStats(), 'secondary'),
  }),
)
```

Multiple deferred props that share a group are fetched together. The
default group is `"default"`.
