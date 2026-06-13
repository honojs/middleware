# @hono/inertia

## 0.6.0

### Minor Changes

- [#1934](https://github.com/honojs/middleware/pull/1934) [`35682a73136e7483bfd22e14659e9a307155f296`](https://github.com/honojs/middleware/commit/35682a73136e7483bfd22e14659e9a307155f296) Thanks [@ashunar0](https://github.com/ashunar0)! - feat(inertia): add infinite scroll with `scroll()`

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

## 0.5.0

### Minor Changes

- [#1932](https://github.com/honojs/middleware/pull/1932) [`5318463bd4be3b6c7abb6f5c46a61bd1d5b36ca6`](https://github.com/honojs/middleware/commit/5318463bd4be3b6c7abb6f5c46a61bd1d5b36ca6) Thanks [@ashunar0](https://github.com/ashunar0)! - feat(inertia): add merge props with `merge()`, `prepend()`, and `deepMerge()`

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
        { matchOn: 'data.id' }
      ),
    })
  )
  ```

  The merge metadata is emitted on every response (initial + partial) so the
  client knows which keys to combine on the next partial reload. Full page visits
  always replace props entirely.

## 0.4.0

### Minor Changes

- [#1911](https://github.com/honojs/middleware/pull/1911) [`c5758a6e4b3ca44c8c03a06effc2e6c7134e4d25`](https://github.com/honojs/middleware/commit/c5758a6e4b3ca44c8c03a06effc2e6c7134e4d25) Thanks [@{](https://github.com/{)! - feat(inertia): add deferred props with `defer()`

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
   id: 1 },                       // sent on initial response
      posts: defer(() => fetchPosts()),      // fetched after mount
      stats: defer(() => fetchStats(), 'secondary'),
    }),
  )
  ```

  Multiple deferred props that share a group are fetched together. The
  default group is `"default"`.

## 0.3.0

### Minor Changes

- [#1904](https://github.com/honojs/middleware/pull/1904) [`a1334f21e77cea7db953825d35f58c271aa7b9fb`](https://github.com/honojs/middleware/commit/a1334f21e77cea7db953825d35f58c271aa7b9fb) Thanks [@ashunar0](https://github.com/ashunar0)! - add server-side support for [Inertia.js partial reloads](https://inertiajs.com/partial-reloads). Honors the `X-Inertia-Partial-Component`, `X-Inertia-Partial-Data` (only), and `X-Inertia-Partial-Except` headers, and accepts function-valued props (`() => T | Promise<T>`) that are evaluated lazily — function props excluded from a partial reload are never invoked, so heavy data fetching can be skipped.

## 0.2.0

### Minor Changes

- [#1869](https://github.com/honojs/middleware/pull/1869) [`a42b19d2d9c6c2c549b0a6d44a4541429ec3d100`](https://github.com/honojs/middleware/commit/a42b19d2d9c6c2c549b0a6d44a4541429ec3d100) Thanks [@adwd](https://github.com/adwd)! - feat(inertia): return props for JSON requests

## 0.1.0

### Minor Changes

- [#1867](https://github.com/honojs/middleware/pull/1867) [`370af84db39a5e85767f14c8edf1969fe7b4d377`](https://github.com/honojs/middleware/commit/370af84db39a5e85767f14c8edf1969fe7b4d377) Thanks [@yusukebe](https://github.com/yusukebe)! - Add `@hono/inertia`: an [Inertia.js](https://inertiajs.com) adapter middleware for Hono. Wire up `c.render(component, props)` to speak the full Inertia protocol (JSON page objects for in-app navigation, full HTML for initial loads, `409` redirects on asset version mismatch). Framework agnostic via the `rootView` option, with a bundled `@hono/inertia/vite` plugin that generates a typed `pages.gen.ts` for end-to-end type safety on `c.render`.
