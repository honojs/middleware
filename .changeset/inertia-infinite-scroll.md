---
'@hono/inertia': minor
---

feat(inertia): add infinite scroll with `scroll()`

Adds a `scroll()` helper that wraps a paginated page payload with the metadata
the Inertia client's `<InfiniteScroll>` adapter needs to keep loading more items
as the user scrolls:

```ts
users: scroll({
  data: await db.users.page(currentPage),
  currentPage,
  lastPage: 10,
  pageName: 'users_page',
  matchOn: 'id',
})
```

The value travels as-is; the renderer emits `page.scrollProps[key] = {
previousPage, nextPage, currentPage, pageName }` on every response and opts the
prop into the merge protocol — defaulting to `append`, switched to `prepend`
when the client sends `X-Inertia-Infinite-Scroll-Merge-Intent: prepend`. The
optional `matchOn` is forwarded as `page.matchPropsOn` for client-side dedupe.
Mirrors `Inertia::scroll(...)` in inertia-laravel 3.x.
