# @hono/inertia

> [!WARNING]
> **Experimental.**

**The SPA, minus the API.** [Inertia.js](https://inertiajs.com) on [Hono](https://hono.dev) — render React, Vue, or Svelte straight from your routes and skip the REST endpoints, the client side router, and the data fetching layer entirely.

```ts
app.use(inertia())
app.get('/posts/:id', (c) => c.render('Posts/Show', { post }))
```

That's it. The middleware speaks the full [Inertia protocol](https://inertiajs.com/the-protocol) — JSON page objects for in-app navigation, hydratable HTML for initial loads, `409` redirects on asset version mismatch — while staying framework agnostic. Plug in any view layer through `rootView`, get end-to-end type safety on `c.render(component, props)` via the bundled Vite plugin, and ship to any runtime Hono runs on.

## Install

```bash
npm i @hono/inertia
```

## Usage

Define your `rootView` as its own function — it returns the HTML shell that boots the SPA — then pass it to the middleware. Use the `serializePage` helper to embed the page object safely:

```ts
// app/root-view.ts
import { serializePage, type RootView } from '@hono/inertia'

export const rootView: RootView = (page) => `<!DOCTYPE html>
<html>
  <head>
    <title>App</title>
    <script type="module" src="/src/client.tsx"></script>
  </head>
  <body>
    <div id="app" data-page="${serializePage(page)}"></div>
  </body>
</html>`
```

```ts
// app/server.ts
import { Hono } from 'hono'
import { inertia } from '@hono/inertia'
import { rootView } from './root-view'

const app = new Hono()

app.use(inertia({ version: '1', rootView }))

const routes = app
  .get('/', (c) => c.render('Home', { message: 'Hello, Inertia' }))
  .get('/posts/:id', (c) => c.render('Posts/Show', { id: c.req.param('id') }))

export default routes
```

### React + Vite (`vite-ssr-components`) example

Pair `@hono/inertia` with [`vite-ssr-components`](https://github.com/yusukebe/vite-ssr-components) to wire up Vite's HMR client and module scripts during development. The `<ViteClient />`, `<Script />` and `<Link />` helpers emit the right tags in both dev and production builds.

Define the `Document` React component and `rootView` in their own module. React's `renderToString` HTML escapes attribute values automatically, so just pass `JSON.stringify(page)` straight to `data-page`:

```tsx
// app/root-view.tsx
import { renderToString } from 'react-dom/server'
import { Link, Script, ViteClient } from 'vite-ssr-components/react'
import type { PageObject, RootView } from '@hono/inertia'

const Document = ({ page }: { page: PageObject }) => (
  <html>
    <head>
      <ViteClient />
      <Script src='/src/client.tsx' />
      <Link href='/src/style.css' rel='stylesheet' />
    </head>
    <body>
      <div id='app' data-page={JSON.stringify(page)} />
    </body>
  </html>
)

export const rootView: RootView = (page) =>
  '<!DOCTYPE html>' + renderToString(<Document page={page} />)
```

Then plug it into the middleware:

```tsx
// app/server.tsx
import { Hono } from 'hono'
import { inertia } from '@hono/inertia'
import { rootView } from './root-view'

const app = new Hono()

app.use(inertia({ rootView }))

const routes = app
  .get('/', (c) => c.render('Home', { message: 'Hono x Inertia' }))
  .get('/posts/:id', (c) => {
    const id = Number(c.req.param('id'))
    return c.render('Posts/Show', { id })
  })

export default routes
```

Client side bootstrap:

```tsx
// src/client.tsx
import { createInertiaApp, type ResolvedComponent } from '@inertiajs/react'
import { createRoot } from 'react-dom/client'

createInertiaApp({
  resolve: async (name) => {
    const pages = import.meta.glob<{ default: ResolvedComponent }>('../app/pages/**/*.tsx')
    const page = await pages[`../app/pages/${name}.tsx`]()
    return page.default
  },
  setup({ el, App, props }) {
    createRoot(el).render(<App {...props} />)
  },
})
```

Vite config (Cloudflare Workers + Vite):

```ts
// vite.config.ts
import { cloudflare } from '@cloudflare/vite-plugin'
import { defineConfig } from 'vite'
import ssrPlugin from 'vite-ssr-components/plugin'
import { inertiaPages } from '@hono/inertia/vite'

export default defineConfig({
  plugins: [inertiaPages(), cloudflare(), ssrPlugin()],
})
```

## Type safe `c.render`

Use the [`/vite`](#vite-plugin) plugin to generate a `pages.gen.ts` file from your pages directory. Then use `PageProps<C>` in your components to read the exact props for a given page name:

```tsx
// app/pages/Posts/Show.tsx
import type { PageProps } from '../../pages.gen'

export default function Show({ post }: PageProps<'Posts/Show'>) {
  return <article>{post.title}</article>
}
```

The generated file augments the `AppRegistry` interface so `PageProps<C>` resolves against your Hono app's route schema.

## Vite plugin

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { inertiaPages } from '@hono/inertia/vite'

export default defineConfig({
  plugins: [inertiaPages()],
})
```

### Options

| Option         | Type       | Default              | Description                                                             |
| -------------- | ---------- | -------------------- | ----------------------------------------------------------------------- |
| `pagesDir`     | `string`   | `'app/pages'`        | Directory containing page components, relative to the project root.     |
| `outFile`      | `string`   | `'app/pages.gen.ts'` | Output path for the generated file.                                     |
| `extensions`   | `string[]` | `['tsx']`            | File extensions to treat as page components (without leading dot).      |
| `exclude`      | `string[]` | `['Layout']`         | Page names to exclude from the generated union.                         |
| `serverModule` | `string`   | `'./server'`         | Path to the Hono app server module, relative to the generated file.     |
| `packageName`  | `string`   | `'@hono/inertia'`    | Module specifier for `@hono/inertia` used in the generated declaration. |

## Middleware options

### `inertia(options)`

| Option     | Type                                     | Default                                       | Description                                                                                                                                               |
| ---------- | ---------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `version`  | `string \| null`                         | `null`                                        | Asset version. Stale `X-Inertia-Version` on a GET request triggers a `409 Conflict` with an `X-Inertia-Location` header so the client does a full reload. |
| `rootView` | `(page, c) => string \| Promise<string>` | Minimal HTML shell embedding the page object. | HTML document for the initial (non Inertia) request.                                                                                                      |

## Example app

A complete Cloudflare Workers + React + Vite example lives at [yusukebe/hono-inertia-example](https://github.com/yusukebe/hono-inertia-example).

## License

MIT
