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

/**
 * A prop value that can be resolved lazily. When the value is a function it
 * is only invoked if the prop is included in the current render, which is the
 * key mechanism behind partial reloads — heavy data fetching can be skipped
 * for props that the client did not request.
 */
export type Resolvable<T> = T | (() => T | Promise<T>)

/**
 * Resolved form of a {@link Resolvable}. Resolves the awaited return value of
 * a function prop, or the value itself otherwise.
 */
export type Resolved<T> = T extends (...args: never[]) => infer R ? Awaited<R> : T

/**
 * Applies {@link Resolved} to every property of `P`.
 */
export type ResolvedProps<P> = { [K in keyof P]: Resolved<P[K]> }

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

    c.setRenderer(((component: string, propsInput: Record<string, unknown> = {}) => {
      const url = new URL(c.req.url)

      // Partial reload negotiation: the client (Inertia core) signals
      // "only re-evaluate these props" via X-Inertia-Partial-Component +
      // X-Inertia-Partial-Data / X-Inertia-Partial-Except.
      const partialComponent = c.req.header('X-Inertia-Partial-Component')
      const partialData = c.req.header('X-Inertia-Partial-Data')
      const partialExcept = c.req.header('X-Inertia-Partial-Except')
      const isPartial =
        partialComponent === component && (partialData !== undefined || partialExcept !== undefined)

      const parseKeys = (header: string | undefined): string[] | null =>
        header
          ? header
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : null

      const onlyKeys = isPartial ? parseKeys(partialData) : null
      const exceptKeys = isPartial ? parseKeys(partialExcept) : null

      const isExcluded = (key: string): boolean =>
        (onlyKeys !== null && !onlyKeys.includes(key)) ||
        (exceptKeys !== null && exceptKeys.includes(key))

      // Collect kept entries and decide sync vs async resolution. When no
      // function-valued prop is encountered, the renderer stays fully sync —
      // preserving the original `Response` (non-Promise) return type for the
      // common case.
      const kept: [string, unknown][] = []
      let hasFunction = false
      for (const [key, value] of Object.entries(propsInput)) {
        if (isExcluded(key)) {
          continue
        }
        if (typeof value === 'function') {
          hasFunction = true
        }
        kept.push([key, value])
      }

      const respond = (resolvedProps: Record<string, unknown>) => {
        const page: PageObject = {
          component,
          props: resolvedProps,
          url: url.pathname + url.search,
          version,
        }

        c.header('Vary', 'Accept, X-Inertia')

        if (c.req.header('X-Inertia')) {
          c.header('X-Inertia', 'true')
          return c.json(page)
        }

        if (c.req.header('Accept')?.includes('application/json')) {
          return c.json(resolvedProps)
        }

        const rendered = rootView(page, c)
        if (rendered instanceof Promise) {
          return rendered.then((html) => c.html(html))
        }
        return c.html(rendered)
      }

      if (!hasFunction) {
        return respond(Object.fromEntries(kept))
      }

      return Promise.all(
        kept.map(
          async ([key, value]): Promise<[string, unknown]> => [
            key,
            typeof value === 'function' ? await (value as () => unknown)() : value,
          ]
        )
      ).then((entries) => respond(Object.fromEntries(entries)))
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
    ): Response & TypedResponse<{ component: C; props: ResolvedProps<P> }, 200, 'html'>
  }
  interface NotFoundResponse extends Response, TypedResponse<string, 404, 'text'> {}
}

export type { AppRegistry, PageProps } from './page-props'
