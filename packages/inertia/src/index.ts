/**
 * @module
 * Inertia.js adapter middleware for Hono.
 *
 * Implements the [Inertia.js protocol](https://inertiajs.com/the-protocol) so
 * that `c.render(component, props)` returns the appropriate JSON page object
 * for Inertia XHR requests, props JSON for requests that accept JSON, and a
 * full HTML document for initial page loads.
 */

import type { Context, MiddlewareHandler, TypedResponse } from 'hono'

/**
 * Inertia page object sent to the client.
 *
 * @see https://inertiajs.com/the-protocol#the-page-object
 */
export type PageObject<P = Record<string, unknown>> = {
  component: string
  props: P
  url: string
  version: string | null
}

/**
 * Renders the initial HTML document that bootstraps the Inertia app.
 *
 * Returns a complete HTML string. Embed the page object somewhere readable
 * by the client side adapter (e.g. `<div id="app" data-page="...">`).
 */
export type RootView = (page: PageObject, c: Context) => string | Promise<string>

export interface InertiaOptions {
  /**
   * Asset version. When an Inertia GET request's `X-Inertia-Version` header
   * does not match this value, the middleware short circuits with a
   * `409 Conflict` response and `X-Inertia-Location` header so the client
   * triggers a full page reload.
   *
   * @default null
   */
  version?: string | null

  /**
   * Renders the initial HTML document for non Inertia (full page) requests.
   *
   * Receives the current page object and the Hono context, and returns a
   * complete HTML string. Defaults to a minimal shell that embeds the page
   * object into `<div id="app" data-page="...">`.
   */
  rootView?: RootView
}

/**
 * Serializes a {@link PageObject} into a JSON string that is safe to embed
 * inside a `<script type="application/json">` element.
 *
 * Mirrors `@inertiajs/core`'s `buildSSRBody`: only the forward slash is
 * escaped (`/` → `\/`) so a `</script>` sequence inside the JSON cannot
 * close the surrounding `<script>` tag. No HTML entity encoding is applied
 * because script `textContent` is not HTML parsed.
 */
export const serializePage = (page: PageObject): string =>
  JSON.stringify(page).replace(/\//g, '\\/')

const defaultRootView: RootView = (page) =>
  `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <script data-page="app" type="application/json">${serializePage(page)}</script>
    <div id="app"></div>
  </body>
</html>`

/**
 * Inertia.js middleware for Hono.
 *
 * Sets up `c.render(component, props)` to respond according to the Inertia
 * protocol: JSON page objects for `X-Inertia` requests, props JSON for
 * `Accept: application/json` requests, full HTML otherwise.
 *
 * @example
 * ```ts
 * import { Hono } from 'hono'
 * import { inertia } from '@hono/inertia'
 *
 * const app = new Hono()
 *
 * app.use(inertia())
 *
 * app.get('/', (c) => c.render('Home', { message: 'Hello' }))
 * ```
 */
export const inertia = (options: InertiaOptions = {}): MiddlewareHandler => {
  const version: string | null = options.version ?? null
  const rootView: RootView = options.rootView ?? defaultRootView

  return async function inertia(c, next) {
    if (c.req.header('X-Inertia') && c.req.method === 'GET') {
      const requested = c.req.header('X-Inertia-Version') ?? ''
      const current = version ?? ''
      if (requested !== current) {
        c.header('X-Inertia-Location', c.req.url)
        return c.body(null, 409)
      }
    }

    c.setRenderer(((component: string, props: Record<string, unknown> = {}) => {
      const url = new URL(c.req.url)
      const page: PageObject = {
        component,
        props,
        url: url.pathname + url.search,
        version,
      }

      c.header('Vary', 'Accept, X-Inertia')

      if (c.req.header('X-Inertia')) {
        c.header('X-Inertia', 'true')
        return c.json(page)
      }

      if (c.req.header('Accept')?.includes('application/json')) {
        return c.json(props)
      }

      const rendered = rootView(page, c)
      if (rendered instanceof Promise) {
        return rendered.then((html) => c.html(html))
      }
      return c.html(rendered)
    }) as Parameters<typeof c.setRenderer>[0])

    return next()
  }
}

/**
 * Registry of valid Inertia page component names.
 *
 * Augment this interface to constrain the first argument of `c.render` to
 * known page names. Typically populated automatically by the
 * `@hono/inertia/vite` plugin from your pages directory.
 *
 * When empty, `c.render` accepts any string for backwards compatibility.
 *
 * @example
 * ```ts
 * declare module '@hono/inertia' {
 *   interface InertiaPages {
 *     Home: unknown
 *     'Posts/Show': unknown
 *   }
 * }
 * ```
 */
export interface InertiaPages {}

/**
 * Union of registered page component names. Falls back to `string` when
 * {@link InertiaPages} has not been augmented.
 */
export type PageName = keyof InertiaPages extends never
  ? string
  : Extract<keyof InertiaPages, string>

declare module 'hono' {
  interface ContextRenderer {
    <C extends PageName, P = Record<string, never>>(
      component: C,
      props?: P
    ): Response & TypedResponse<{ component: C; props: P }, 200, 'html'>
  }
  interface NotFoundResponse extends Response, TypedResponse<string, 404, 'text'> {}
}

export type { AppRegistry, PageProps } from './page-props'
