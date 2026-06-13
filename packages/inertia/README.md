# @hono/inertia

> [!WARNING]
> **Experimental.**

**The SPA, minus the API.** [Inertia.js](https://inertiajs.com) on [Hono](https://hono.dev) — render React, Vue, or Svelte straight from your routes and skip the REST endpoints, the client side router, and the data fetching layer entirely.

```ts
app.use(inertia())
app.get('/posts/:id', (c) => c.render('Posts/Show', { post }))
```

That's it. The middleware speaks the full [Inertia protocol](https://inertiajs.com/the-protocol) — JSON page objects for in-app navigation, hydratable HTML for initial loads, `409` redirects on asset version mismatch — while staying framework agnostic. It also returns the rendered props JSON directly when a request accepts `application/json`, so the same route can serve a JSON response without an extra endpoint. Plug in any view layer through `rootView`, get end-to-end type safety on `c.render(component, props)` via the bundled Vite plugin, and ship to any runtime Hono runs on.

## Install

```bash
npm i @hono/inertia
```

## Usage

Define your `rootView` as its own function — it returns the HTML shell that boots the SPA — then pass it to the middleware. Use the `serializePage` helper to embed the page object inside the `<script>` tag that Inertia's client adapter reads from on boot:

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
    <script data-page="app" type="application/json">${serializePage(page)}</script>
    <div id="app"></div>
  </body>
</html>`
```

The `data-page` attribute holds the **mount element id** (matching `createInertiaApp({ id: 'app' })`'s default), and the JSON payload lives in the script's `textContent`. `serializePage` mirrors the official [`@inertiajs/core`](https://github.com/inertiajs/inertia) escape (only `/` → `\/`) so a `</script>` inside your props can't break out of the surrounding tag.

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

Define the `Document` React component and `rootView` in their own module. Inject the serialized page via `dangerouslySetInnerHTML` so React drops it into the `<script>` body verbatim:

```tsx
// app/root-view.tsx
import { renderToString } from 'react-dom/server'
import { Link, Script, ViteClient } from 'vite-ssr-components/react'
import { serializePage, type PageObject, type RootView } from '@hono/inertia'

const Document = ({ page }: { page: PageObject }) => (
  <html>
    <head>
      <ViteClient />
      <Script src='/src/client.tsx' />
      <Link href='/src/style.css' rel='stylesheet' />
    </head>
    <body>
      <script
        data-page='app'
        type='application/json'
        dangerouslySetInnerHTML={{ __html: serializePage(page) }}
      />
      <div id='app' />
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

Out of the box `c.render(name, props)` accepts any string for `name`. Wire up the [`/vite`](#vite-plugin) plugin to generate a `pages.gen.ts` file from your pages directory and `c.render`'s first argument is constrained to the actual page names — typos are a compile error:

```ts
// `'About'` exists on disk → ok
c.render('About', { title: 'About' })

// ❌ `'Hme'` is not a registered page name
c.render('Hme', { message: 'oops' })
//       ~~~~~ Argument of type '"Hme"' is not assignable to parameter of type 'PageName'.
```

The generated file augments two interfaces in `@hono/inertia`:

- `InertiaPages` — keys become the union of valid page names, constraining `c.render`'s component argument.
- `AppRegistry` — registers your Hono app instance so `PageProps<C>` resolves to the props type of the matching route handler.

Use `PageProps<C>` in your components to type the props you receive:

```tsx
// app/pages/Posts/Show.tsx
import type { PageProps } from '../../pages.gen'

export default function Show({ post }: PageProps<'Posts/Show'>) {
  return <article>{post.title}</article>
}
```

## Partial reloads

Inertia's [partial reloads](https://inertiajs.com/partial-reloads) let a single visit re-fetch only a subset of the page's props, leaving the rest as they were. `@hono/inertia` honors the `X-Inertia-Partial-Component`, `X-Inertia-Partial-Data`, and `X-Inertia-Partial-Except` headers transparently — the route signature stays the same.

```ts
app.get('/dashboard', (c) =>
  c.render('Dashboard', {
    user, // sent every time
    stats: () => db.heavyQuery(), // function prop — only invoked when included
  })
)
```

Function props (`() => T | Promise<T>`) are evaluated lazily, so heavy data fetching is skipped for props the client did not request. The return type may be synchronous or a `Promise`.

A request is treated as a partial reload only when `X-Inertia-Partial-Component` matches the rendered component **and** at least one of `X-Inertia-Partial-Data` / `X-Inertia-Partial-Except` is present. Otherwise the request is processed as a normal Inertia visit and every prop — including function props — is resolved.

## Deferred props

[Deferred props](https://inertiajs.com/deferred-props) move heavy data fetching off the critical path: the initial response advertises which props are pending, the page becomes interactive immediately, and the Inertia client then issues a follow-up partial reload to fill them in.

Wrap the resolver with `defer()`:

```ts
import { defer, inertia } from '@hono/inertia'

app.use(inertia())

app.get('/', (c) =>
  c.render('Dashboard', {
    user: { id: 1 }, // sent on the initial response
    posts: defer(() => fetchPosts()), // resolved after mount
    stats: defer(() => fetchStats(), 'secondary'),
  })
)
```

Multiple deferred props sharing the same `group` (the second argument, default `'default'`) are fetched together in a single follow-up request. On the initial response the resolvers are not invoked and the keys are advertised under `page.deferredProps[group]`; on the follow-up partial reload only the requested resolvers run.

## Merge props

By default a partial reload **replaces** the cached prop value. [Merge props](https://inertiajs.com/merging-props) instead **combine** the incoming value with the cached one — append items to a list, prepend new notifications, or deep merge a paginated wrapper. The value travels as-is and the metadata (`page.mergeProps` / `prependProps` / `deepMergeProps` / `matchPropsOn`) tells the Inertia client how to combine it on the next partial reload.

Pick the helper that matches the shape:

```ts
import { deepMerge, inertia, merge, prepend } from '@hono/inertia'

app.use(inertia())

app.get('/feed', (c) =>
  c.render('Feed', {
    // append: concat array items / shallow-spread object keys
    posts: merge(await db.posts.page(n), { matchOn: 'id' }),

    // prepend: insert new items at the start
    notifications: prepend(await fetchNotifications(), { matchOn: 'id' }),

    // deep merge: recurse into wrapper-shaped paginated props
    conversations: deepMerge(
      { data: await db.messages.page(n), meta: { nextCursor } },
      { matchOn: 'data.id' }
    ),
  })
)
```

`matchOn` accepts a string or array of strings and is emitted as `<propKey>.<field>` on `page.matchPropsOn` (e.g. `merge(posts, { matchOn: 'id' })` on the `posts` prop ⇒ `matchPropsOn: ['posts.id']`), which the client uses to dedupe items by that field.

The merge metadata is included on **every** response — initial and partial — so the client knows which keys to combine on the next partial reload. Full page visits always replace props entirely; merging only kicks in on subsequent partial reloads.

## Infinite scroll

[Infinite scroll](https://inertiajs.com/docs/v2/data-props/infinite-scroll) keeps loading more items as the user scrolls — feeds, search results, chat history. The Inertia client's `<InfiniteScroll>` adapter handles the IntersectionObserver and the partial-reload requests; the server just needs to advertise the paging cursor.

Wrap the page payload with `scroll()`:

```ts
import { inertia, scroll } from '@hono/inertia'

app.use(inertia())

app.get('/users', async (c) => {
  const currentPage = Number(c.req.query('users_page') ?? 1)
  return c.render('Users/Index', {
    users: scroll({
      data: await db.users.page(currentPage),
      currentPage,
      lastPage: 10,
      pageName: 'users_page',
      matchOn: 'id',
    }),
  })
})
```

The renderer emits `page.scrollProps[key] = { previousPage, nextPage, currentPage, pageName }` — what the `<InfiniteScroll>` adapter reads to decide when to fetch the next page and which query string to use (e.g. `pageName: 'users_page'` ⇒ `?users_page=2`). `previousPage` is `currentPage - 1` (or `null` on the first page); `nextPage` is `currentPage + 1` (or `null` on the last page).

Scroll props also opt into the [merge protocol](#merge-props) automatically. By default each incoming page is **appended** to the cached array; when the client sends `X-Inertia-Infinite-Scroll-Merge-Intent: prepend` (e.g. when scrolling backwards), the prop is moved into `page.prependProps` for that response instead. The optional `matchOn` is forwarded as `page.matchPropsOn` exactly like in `merge()` — accepting a string or array, with no default (omit it to skip dedupe).

Full page visits always replace props entirely; the append/prepend behaviour only kicks in on subsequent partial reloads.

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

## Authors

- Yusuke Wada <https://github.com/yusukebe>
- Asahi Kawanobe <https://github.com/ashunar0>

## License

MIT
