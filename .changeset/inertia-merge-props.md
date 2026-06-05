---
'@hono/inertia': minor
---

feat(inertia): add merge props with `merge()`, `prepend()`, and `deepMerge()`

Adds three helpers that mark a prop for client-side combination on the
**next partial reload**, instead of the default replace behavior:

- `merge(data, { matchOn? })` — appends array items / shallow-spreads object keys.
- `prepend(data, { matchOn? })` — same as `merge()` but inserts at the start.
- `deepMerge(data, { matchOn? })` — recurses into nested arrays/objects (use for
  wrapper-shaped paginated props like `{ data: [...], meta: {...} }`).

The value travels as-is; the renderer advertises which keys to combine via the
new `page.mergeProps` / `page.prependProps` / `page.deepMergeProps` arrays and
emits dot-paths on `page.matchPropsOn` for the client's dedupe logic.

```ts
import { deepMerge, inertia, merge, prepend } from '@hono/inertia'

app.use(inertia())

app.get('/feed', (c) =>
  c.render('Feed', {
    posts: merge(await db.posts.page(n), { matchOn: 'id' }),
    notifications: prepend(await fetchNotifications(), { matchOn: 'id' }),
    conversations: deepMerge(
      { data: await db.messages.page(n), meta: { nextCursor } },
      { matchOn: 'data.id' },
    ),
  }),
)
```

The merge metadata is emitted on every response (initial + partial) so the
client knows which keys to combine on the next partial reload. Full page visits
always replace props entirely.
