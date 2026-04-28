# @hono/inertia

## 0.1.0

### Minor Changes

- [#1867](https://github.com/honojs/middleware/pull/1867) [`370af84db39a5e85767f14c8edf1969fe7b4d377`](https://github.com/honojs/middleware/commit/370af84db39a5e85767f14c8edf1969fe7b4d377) Thanks [@yusukebe](https://github.com/yusukebe)! - Add `@hono/inertia`: an [Inertia.js](https://inertiajs.com) adapter middleware for Hono. Wire up `c.render(component, props)` to speak the full Inertia protocol (JSON page objects for in-app navigation, full HTML for initial loads, `409` redirects on asset version mismatch). Framework agnostic via the `rootView` option, with a bundled `@hono/inertia/vite` plugin that generates a typed `pages.gen.ts` for end-to-end type safety on `c.render`.
