---
'@hono/inertia': minor
---

Add `@hono/inertia`: an [Inertia.js](https://inertiajs.com) adapter middleware for Hono. Wire up `c.render(component, props)` to speak the full Inertia protocol (JSON page objects for in-app navigation, full HTML for initial loads, `409` redirects on asset version mismatch). Framework agnostic via the `rootView` option, with a bundled `@hono/inertia/vite` plugin that generates a typed `pages.gen.ts` for end-to-end type safety on `c.render`.
