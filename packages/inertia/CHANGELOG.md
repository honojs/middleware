# @hono/inertia

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
