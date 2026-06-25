import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import type { PageObject, ScrollDescriptor } from './index'
import { deepMerge, defer, inertia, merge, prepend, scroll } from './index'

describe('inertia', () => {
  describe('full page (non Inertia request)', () => {
    it('renders the default HTML root view with the page object embedded', async () => {
      const app = new Hono()
      app.use(inertia())
      app.get('/', (c) => c.render('Home', { message: 'hello' }))

      const res = await app.request('/')

      expect(res.status).toBe(200)
      expect(res.headers.get('Vary')).toBe('Accept, X-Inertia')
      expect(res.headers.get('content-type')).toContain('text/html')
      const html = await res.text()
      expect(html).toContain('<!DOCTYPE html>')
      expect(html).toContain('<div id="app"></div>')
      expect(html).toContain('<script data-page="app" type="application/json">')
      expect(html).toContain('"component":"Home"')
      expect(html).toContain('"message":"hello"')
    })

    it('passes the page object and context to a custom rootView', async () => {
      const seen: PageObject[] = []
      const app = new Hono()
      app.use(
        inertia({
          version: 'v1',
          rootView: (page, c) => {
            seen.push(page)
            return `<!DOCTYPE html><html><body data-url="${c.req.path}">${page.component}</body></html>`
          },
        })
      )
      app.get('/posts/:id', (c) => c.render('Posts/Show', { id: c.req.param('id') }))

      const res = await app.request('/posts/42?ref=test')

      expect(res.status).toBe(200)
      const html = await res.text()
      expect(html).toContain('data-url="/posts/42"')
      expect(html).toContain('Posts/Show')

      expect(seen).toHaveLength(1)
      expect(seen[0]).toEqual({
        component: 'Posts/Show',
        props: { id: '42' },
        url: '/posts/42?ref=test',
        version: 'v1',
      })
    })

    it('awaits an async rootView before sending the response', async () => {
      const app = new Hono()
      app.use(
        inertia({
          rootView: async (page) => {
            await new Promise((r) => setTimeout(r, 5))
            return `<html><body>${page.component}</body></html>`
          },
        })
      )
      app.get('/', (c) => c.render('Home'))

      const res = await app.request('/')

      expect(res.status).toBe(200)
      expect(await res.text()).toBe('<html><body>Home</body></html>')
    })

    it('escapes "/" so an embedded "</script>" cannot close the surrounding tag', async () => {
      const app = new Hono()
      app.use(inertia())
      app.get('/', (c) => c.render('Home', { evil: '</script><script>x</script>' }))

      const res = await app.request('/')
      const html = await res.text()

      // Only one real <script ...application/json> opening, and one real
      // closing </script> for it. The user payload's </script> must be
      // neutralized via "/" -> "\/".
      expect(html).toContain('<\\/script>')
      expect(html.match(/<script data-page="app" type="application\/json">/g)).toHaveLength(1)
      expect(html.match(/<\/script>/g)).toHaveLength(1)
    })

    it('defaults version to null in the page object', async () => {
      const seen: PageObject[] = []
      const app = new Hono()
      app.use(
        inertia({
          rootView: (page) => {
            seen.push(page)
            return '<html />'
          },
        })
      )
      app.get('/', (c) => c.render('Home'))

      await app.request('/')

      expect(seen[0]?.version).toBeNull()
    })

    it('responds with JSON props when JSON is accepted', async () => {
      const app = new Hono()
      app.use(inertia())
      app.get('/', (c) => c.render('Home', { message: 'hello' }))

      const res = await app.request('/', {
        headers: {
          Accept: 'application/json',
        },
      })

      expect(res.status).toBe(200)
      expect(res.headers.get('Vary')).toBe('Accept, X-Inertia')
      expect(res.headers.get('content-type')).toContain('application/json')
      expect(await res.json()).toEqual({ message: 'hello' })
    })
  })

  describe('Inertia (XHR) request', () => {
    it('responds with JSON page object and Inertia headers', async () => {
      const app = new Hono()
      app.use(inertia({ version: 'abc123' }))
      app.get('/posts', (c) => c.render('Posts/Index', { posts: [{ id: 1 }] }))

      const res = await app.request('/posts?page=2', {
        headers: {
          'X-Inertia': 'true',
          'X-Inertia-Version': 'abc123',
        },
      })

      expect(res.status).toBe(200)
      expect(res.headers.get('X-Inertia')).toBe('true')
      expect(res.headers.get('Vary')).toBe('Accept, X-Inertia')
      expect(res.headers.get('content-type')).toContain('application/json')
      expect(await res.json()).toEqual({
        component: 'Posts/Index',
        props: { posts: [{ id: 1 }] },
        url: '/posts?page=2',
        version: 'abc123',
      })
    })

    it('responds with 409 and X-Inertia-Location when version is stale on GET', async () => {
      const app = new Hono()
      app.use(inertia({ version: 'v2' }))
      app.get('/', (c) => c.render('Home'))

      const res = await app.request('http://localhost/posts', {
        headers: {
          'X-Inertia': 'true',
          'X-Inertia-Version': 'v1',
        },
      })

      expect(res.status).toBe(409)
      expect(res.headers.get('X-Inertia-Location')).toBe('http://localhost/posts')
      expect(await res.text()).toBe('')
    })

    it('does not enforce version on non GET requests', async () => {
      const app = new Hono()
      app.use(inertia({ version: 'v2' }))
      app.post('/', (c) => c.render('Home', { ok: true }))

      const res = await app.request('/', {
        method: 'POST',
        headers: {
          'X-Inertia': 'true',
          'X-Inertia-Version': 'mismatched',
        },
      })

      expect(res.status).toBe(200)
      expect(res.headers.get('X-Inertia')).toBe('true')
    })

    it('treats a missing X-Inertia-Version header as empty string', async () => {
      const app = new Hono()
      app.use(inertia()) // version defaults to null -> ''
      app.get('/', (c) => c.render('Home'))

      const res = await app.request('/', { headers: { 'X-Inertia': 'true' } })

      expect(res.status).toBe(200)
      expect(res.headers.get('X-Inertia')).toBe('true')
    })
  })

  describe('page.url resolution', () => {
    it('uses c.req.url for GET requests', async () => {
      const app = new Hono()
      app.use(inertia({ version: 'v1' }))
      app.get('/users', (c) => c.render('Users/Index', { users: [] }))

      const res = await app.request('/users?page=2', {
        headers: {
          'X-Inertia': 'true',
          'X-Inertia-Version': 'v1',
          Referer: 'http://localhost/users?page=1',
        },
      })

      const body = (await res.json()) as PageObject
      expect(body.url).toBe('/users?page=2')
    })

    it('uses the Referer for non-GET requests to keep the original URL', async () => {
      const app = new Hono()
      app.use(inertia({ version: 'v1' }))
      app.post('/users', (c) => c.render('Users/New'))

      const res = await app.request('/users', {
        method: 'POST',
        headers: {
          'X-Inertia': 'true',
          'X-Inertia-Version': 'v1',
          Referer: 'http://localhost/users/new',
        },
      })

      const body = (await res.json()) as PageObject
      expect(body.url).toBe('/users/new')
    })

    it('falls back to c.req.url when Referer is missing on non-GET requests', async () => {
      const app = new Hono()
      app.use(inertia({ version: 'v1' }))
      app.post('/users', (c) => c.render('Users/New'))

      const res = await app.request('/users', {
        method: 'POST',
        headers: { 'X-Inertia': 'true', 'X-Inertia-Version': 'v1' },
      })

      const body = (await res.json()) as PageObject
      expect(body.url).toBe('/users')
    })

    it('overrides page.url via options.url on a non-GET request', async () => {
      const app = new Hono()
      app.use(inertia({ version: 'v1' }))
      app.post('/users', (c) => c.render('Users/New', {}, { url: '/users/new' }))

      const res = await app.request('/users', {
        method: 'POST',
        headers: { 'X-Inertia': 'true', 'X-Inertia-Version': 'v1' },
      })

      const body = (await res.json()) as PageObject
      expect(body.url).toBe('/users/new')
    })

    it('prefers options.url over Referer when both are present on a non-GET request', async () => {
      const app = new Hono()
      app.use(inertia({ version: 'v1' }))
      app.post('/users', (c) => c.render('Users/New', {}, { url: '/override' }))

      const res = await app.request('/users', {
        method: 'POST',
        headers: {
          'X-Inertia': 'true',
          'X-Inertia-Version': 'v1',
          Referer: 'http://localhost/users/new',
        },
      })

      const body = (await res.json()) as PageObject
      expect(body.url).toBe('/override')
    })

    it('keeps only the pathname when options.url is an absolute URL', async () => {
      const app = new Hono()
      app.use(inertia({ version: 'v1' }))
      app.post('/users', (c) => c.render('Users/New', {}, { url: 'https://example.com/override' }))

      const res = await app.request('/users', {
        method: 'POST',
        headers: { 'X-Inertia': 'true', 'X-Inertia-Version': 'v1' },
      })

      const body = (await res.json()) as PageObject
      expect(body.url).toBe('/override')
    })
  })

  describe('partial reload', () => {
    const partialHeaders = (component: string, only?: string, except?: string) => {
      const headers: Record<string, string> = {
        'X-Inertia': 'true',
        'X-Inertia-Version': 'v1',
        'X-Inertia-Partial-Component': component,
      }
      if (only !== undefined) {
        headers['X-Inertia-Partial-Data'] = only
      }
      if (except !== undefined) {
        headers['X-Inertia-Partial-Except'] = except
      }
      return headers
    }

    it('returns only the props listed in X-Inertia-Partial-Data', async () => {
      const app = new Hono()
      app.use(inertia({ version: 'v1' }))
      app.get('/', (c) => c.render('Home', { a: 1, b: 2, c: 3 }))

      const res = await app.request('/', { headers: partialHeaders('Home', 'a,c') })

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({
        component: 'Home',
        props: { a: 1, c: 3 },
        url: '/',
        version: 'v1',
      })
    })

    it('excludes the props listed in X-Inertia-Partial-Except', async () => {
      const app = new Hono()
      app.use(inertia({ version: 'v1' }))
      app.get('/', (c) => c.render('Home', { a: 1, b: 2, c: 3 }))

      const res = await app.request('/', {
        headers: partialHeaders('Home', undefined, 'b'),
      })

      const body = (await res.json()) as { props: Record<string, unknown> }
      expect(body.props).toEqual({ a: 1, c: 3 })
    })

    it('does not invoke lazy function props that are filtered out', async () => {
      const calls: string[] = []
      const app = new Hono()
      app.use(inertia({ version: 'v1' }))
      app.get('/', (c) =>
        c.render('Home', {
          heavy: () => {
            calls.push('heavy')
            return 'h'
          },
          light: () => {
            calls.push('light')
            return 'l'
          },
        })
      )

      const res = await app.request('/', { headers: partialHeaders('Home', 'light') })

      expect(calls).toEqual(['light'])
      const body = (await res.json()) as { props: Record<string, unknown> }
      expect(body.props).toEqual({ light: 'l' })
    })

    it('invokes every function prop on a normal Inertia visit', async () => {
      const calls: string[] = []
      const app = new Hono()
      app.use(inertia({ version: 'v1' }))
      app.get('/', (c) =>
        c.render('Home', {
          a: () => {
            calls.push('a')
            return 1
          },
          b: () => {
            calls.push('b')
            return 2
          },
        })
      )

      const res = await app.request('/', {
        headers: { 'X-Inertia': 'true', 'X-Inertia-Version': 'v1' },
      })

      expect(calls.sort()).toEqual(['a', 'b'])
      const body = (await res.json()) as { props: Record<string, unknown> }
      expect(body.props).toEqual({ a: 1, b: 2 })
    })

    it('awaits async function props', async () => {
      const app = new Hono()
      app.use(inertia({ version: 'v1' }))
      app.get('/', (c) =>
        c.render('Home', {
          users: async () => {
            await new Promise((r) => setTimeout(r, 5))
            return [{ id: 1 }]
          },
        })
      )

      const res = await app.request('/', {
        headers: { 'X-Inertia': 'true', 'X-Inertia-Version': 'v1' },
      })

      const body = (await res.json()) as { props: Record<string, unknown> }
      expect(body.props).toEqual({ users: [{ id: 1 }] })
    })

    it('ignores partial headers when the component does not match', async () => {
      const calls: string[] = []
      const app = new Hono()
      app.use(inertia({ version: 'v1' }))
      app.get('/', (c) =>
        c.render('Home', {
          x: () => {
            calls.push('x')
            return 1
          },
        })
      )

      const res = await app.request('/', { headers: partialHeaders('Other', 'x') })

      expect(calls).toEqual(['x'])
      const body = (await res.json()) as { props: Record<string, unknown> }
      expect(body.props).toEqual({ x: 1 })
    })

    it('handles whitespace and empty entries in the header list', async () => {
      const app = new Hono()
      app.use(inertia({ version: 'v1' }))
      app.get('/', (c) => c.render('Home', { a: 1, b: 2, c: 3 }))

      const res = await app.request('/', {
        headers: partialHeaders('Home', ' a , , c '),
      })

      const body = (await res.json()) as { props: Record<string, unknown> }
      expect(body.props).toEqual({ a: 1, c: 3 })
    })

    it('applies only and except in combination (intersection)', async () => {
      const app = new Hono()
      app.use(inertia({ version: 'v1' }))
      app.get('/', (c) => c.render('Home', { a: 1, b: 2, c: 3 }))

      const res = await app.request('/', {
        headers: partialHeaders('Home', 'a,b', 'b'),
      })

      const body = (await res.json()) as { props: Record<string, unknown> }
      expect(body.props).toEqual({ a: 1 })
    })

    it('treats only/except headers as full visit when partial component is absent', async () => {
      const calls: string[] = []
      const app = new Hono()
      app.use(inertia({ version: 'v1' }))
      app.get('/', (c) =>
        c.render('Home', {
          a: () => {
            calls.push('a')
            return 1
          },
          b: () => {
            calls.push('b')
            return 2
          },
        })
      )

      // Only/Except without Partial-Component => not a partial reload
      const res = await app.request('/', {
        headers: {
          'X-Inertia': 'true',
          'X-Inertia-Version': 'v1',
          'X-Inertia-Partial-Data': 'a',
        },
      })

      expect(calls.sort()).toEqual(['a', 'b'])
      const body = (await res.json()) as { props: Record<string, unknown> }
      expect(body.props).toEqual({ a: 1, b: 2 })
    })
  })

  describe('deferred props', () => {
    const partialHeaders = (component: string, only?: string) => {
      const headers: Record<string, string> = {
        'X-Inertia': 'true',
        'X-Inertia-Version': 'v1',
        'X-Inertia-Partial-Component': component,
      }
      if (only !== undefined) {
        headers['X-Inertia-Partial-Data'] = only
      }
      return headers
    }

    it('skips the resolver and advertises the key on the initial Inertia visit', async () => {
      const calls: string[] = []
      const app = new Hono()
      app.use(inertia({ version: 'v1' }))
      app.get('/', (c) =>
        c.render('Home', {
          user: { id: 1 },
          posts: defer(() => {
            calls.push('posts')
            return [{ id: 1 }]
          }),
        })
      )

      const res = await app.request('/', {
        headers: { 'X-Inertia': 'true', 'X-Inertia-Version': 'v1' },
      })

      expect(calls).toEqual([])
      const body = (await res.json()) as {
        props: Record<string, unknown>
        deferredProps?: Record<string, string[]>
      }
      expect(body.props).toEqual({ user: { id: 1 } })
      expect(body.deferredProps).toEqual({ default: ['posts'] })
    })

    it('groups deferred keys by the provided group name', async () => {
      const app = new Hono()
      app.use(inertia({ version: 'v1' }))
      app.get('/', (c) =>
        c.render('Home', {
          posts: defer(() => [{ id: 1 }]),
          stats: defer(() => ({ total: 10 }), 'secondary'),
          comments: defer(() => [], 'secondary'),
        })
      )

      const res = await app.request('/', {
        headers: { 'X-Inertia': 'true', 'X-Inertia-Version': 'v1' },
      })

      const body = (await res.json()) as {
        props: Record<string, unknown>
        deferredProps?: Record<string, string[]>
      }
      expect(body.props).toEqual({})
      expect(body.deferredProps).toEqual({
        default: ['posts'],
        secondary: ['stats', 'comments'],
      })
    })

    it('resolves a deferred prop when it is requested via partial reload', async () => {
      const calls: string[] = []
      const app = new Hono()
      app.use(inertia({ version: 'v1' }))
      app.get('/', (c) =>
        c.render('Home', {
          user: { id: 1 },
          posts: defer(async () => {
            await Promise.resolve()
            calls.push('posts')
            return [{ id: 1 }, { id: 2 }]
          }),
        })
      )

      const res = await app.request('/', { headers: partialHeaders('Home', 'posts') })

      expect(calls).toEqual(['posts'])
      const body = (await res.json()) as {
        props: Record<string, unknown>
        deferredProps?: Record<string, string[]>
      }
      expect(body.props).toEqual({ posts: [{ id: 1 }, { id: 2 }] })
      // deferredProps must not be re-emitted on partial reloads, otherwise
      // the client would loop fetching the same group forever.
      expect(body.deferredProps).toBeUndefined()
    })

    it('does not invoke deferred resolvers that are not in only', async () => {
      const calls: string[] = []
      const app = new Hono()
      app.use(inertia({ version: 'v1' }))
      app.get('/', (c) =>
        c.render('Home', {
          posts: defer(() => {
            calls.push('posts')
            return [{ id: 1 }]
          }),
          stats: defer(() => {
            calls.push('stats')
            return { total: 10 }
          }, 'secondary'),
        })
      )

      const res = await app.request('/', { headers: partialHeaders('Home', 'posts') })

      expect(calls).toEqual(['posts'])
      const body = (await res.json()) as { props: Record<string, unknown> }
      expect(body.props).toEqual({ posts: [{ id: 1 }] })
    })

    it('skips deferred props on non-Inertia JSON requests', async () => {
      const calls: string[] = []
      const app = new Hono()
      app.use(inertia({ version: 'v1' }))
      app.get('/', (c) =>
        c.render('Home', {
          user: { id: 1 },
          posts: defer(() => {
            calls.push('posts')
            return [{ id: 1 }]
          }),
        })
      )

      const res = await app.request('/', { headers: { Accept: 'application/json' } })

      expect(calls).toEqual([])
      expect(await res.json()).toEqual({ user: { id: 1 } })
    })

    it('embeds the deferredProps map in the initial HTML page object', async () => {
      const app = new Hono()
      app.use(inertia({ version: 'v1' }))
      app.get('/', (c) =>
        c.render('Home', {
          user: { id: 1 },
          posts: defer(() => [{ id: 1 }]),
        })
      )

      const res = await app.request('/')

      const html = await res.text()
      expect(html).toContain('"deferredProps":{"default":["posts"]}')
      expect(html).not.toContain('"posts":[{')
    })

    it('mixes deferred props with eager function props on partial reloads', async () => {
      const calls: string[] = []
      const app = new Hono()
      app.use(inertia({ version: 'v1' }))
      app.get('/', (c) =>
        c.render('Home', {
          user: () => {
            calls.push('user')
            return { id: 1 }
          },
          posts: defer(() => {
            calls.push('posts')
            return [{ id: 1 }]
          }),
        })
      )

      const res = await app.request('/', { headers: partialHeaders('Home', 'user,posts') })

      expect(calls.sort()).toEqual(['posts', 'user'])
      const body = (await res.json()) as { props: Record<string, unknown> }
      expect(body.props).toEqual({ user: { id: 1 }, posts: [{ id: 1 }] })
    })

    it('omits deferredProps from the page object when no prop is deferred', async () => {
      const app = new Hono()
      app.use(inertia({ version: 'v1' }))
      app.get('/', (c) => c.render('Home', { user: { id: 1 } }))

      const res = await app.request('/', {
        headers: { 'X-Inertia': 'true', 'X-Inertia-Version': 'v1' },
      })

      const body = (await res.json()) as { deferredProps?: Record<string, string[]> }
      expect(body.deferredProps).toBeUndefined()
    })

    it('omits a deferred prop from initial response even on default (non-XHR) HTML visits', async () => {
      const calls: string[] = []
      const app = new Hono()
      app.use(inertia({ version: 'v1' }))
      app.get('/', (c) =>
        c.render('Home', {
          user: { id: 1 },
          posts: defer(() => {
            calls.push('posts')
            return [{ id: 1 }]
          }),
        })
      )

      const res = await app.request('/')

      expect(calls).toEqual([])
      const html = await res.text()
      expect(html).toContain('"user":{"id":1}')
      expect(html).not.toContain('"posts":[')
    })
  })

  describe('merge props', () => {
    const partialHeaders = (component: string, only?: string) => {
      const headers: Record<string, string> = {
        'X-Inertia': 'true',
        'X-Inertia-Version': 'v1',
        'X-Inertia-Partial-Component': component,
      }
      if (only !== undefined) {
        headers['X-Inertia-Partial-Data'] = only
      }
      return headers
    }

    it('emits page.mergeProps and unwraps the value for merge()', async () => {
      const app = new Hono()
      app.use(inertia({ version: 'v1' }))
      app.get('/', (c) =>
        c.render('Feed', {
          posts: merge([{ id: 1 }, { id: 2 }]),
        })
      )

      const res = await app.request('/', {
        headers: { 'X-Inertia': 'true', 'X-Inertia-Version': 'v1' },
      })

      const body = (await res.json()) as {
        props: Record<string, unknown>
        mergeProps?: string[]
        prependProps?: string[]
        deepMergeProps?: string[]
        matchPropsOn?: string[]
      }
      expect(body.props).toEqual({ posts: [{ id: 1 }, { id: 2 }] })
      expect(body.mergeProps).toEqual(['posts'])
      expect(body.prependProps).toBeUndefined()
      expect(body.deepMergeProps).toBeUndefined()
      expect(body.matchPropsOn).toBeUndefined()
    })

    it('emits page.prependProps for prepend()', async () => {
      const app = new Hono()
      app.use(inertia({ version: 'v1' }))
      app.get('/', (c) =>
        c.render('Feed', {
          notifications: prepend([{ id: 1 }]),
        })
      )

      const res = await app.request('/', {
        headers: { 'X-Inertia': 'true', 'X-Inertia-Version': 'v1' },
      })

      const body = (await res.json()) as {
        props: Record<string, unknown>
        prependProps?: string[]
      }
      expect(body.props).toEqual({ notifications: [{ id: 1 }] })
      expect(body.prependProps).toEqual(['notifications'])
    })

    it('emits page.deepMergeProps for deepMerge()', async () => {
      const app = new Hono()
      app.use(inertia({ version: 'v1' }))
      app.get('/', (c) =>
        c.render('Feed', {
          feed: deepMerge({ data: [{ id: 1 }], meta: { total: 1 } }),
        })
      )

      const res = await app.request('/', {
        headers: { 'X-Inertia': 'true', 'X-Inertia-Version': 'v1' },
      })

      const body = (await res.json()) as {
        props: Record<string, unknown>
        deepMergeProps?: string[]
      }
      expect(body.props).toEqual({ feed: { data: [{ id: 1 }], meta: { total: 1 } } })
      expect(body.deepMergeProps).toEqual(['feed'])
    })

    it('builds matchPropsOn as "<key>.<field>" from a single matchOn string', async () => {
      const app = new Hono()
      app.use(inertia({ version: 'v1' }))
      app.get('/', (c) =>
        c.render('Feed', {
          posts: merge([{ id: 1 }], { matchOn: 'id' }),
        })
      )

      const res = await app.request('/', {
        headers: { 'X-Inertia': 'true', 'X-Inertia-Version': 'v1' },
      })

      const body = (await res.json()) as { matchPropsOn?: string[] }
      expect(body.matchPropsOn).toEqual(['posts.id'])
    })

    it('expands an array matchOn into one matchPropsOn entry per field', async () => {
      const app = new Hono()
      app.use(inertia({ version: 'v1' }))
      app.get('/', (c) =>
        c.render('Feed', {
          conversations: deepMerge(
            { data: [{ id: 1, threadId: 'a' }] },
            { matchOn: ['data.id', 'data.threadId'] }
          ),
        })
      )

      const res = await app.request('/', {
        headers: { 'X-Inertia': 'true', 'X-Inertia-Version': 'v1' },
      })

      const body = (await res.json()) as { matchPropsOn?: string[] }
      expect(body.matchPropsOn).toEqual(['conversations.data.id', 'conversations.data.threadId'])
    })

    it('mixes merge / prepend / deepMerge in a single response', async () => {
      const app = new Hono()
      app.use(inertia({ version: 'v1' }))
      app.get('/', (c) =>
        c.render('Feed', {
          posts: merge([{ id: 1 }], { matchOn: 'id' }),
          notifications: prepend([{ id: 9 }], { matchOn: 'id' }),
          conversations: deepMerge({ data: [{ id: 1 }] }, { matchOn: 'data.id' }),
        })
      )

      const res = await app.request('/', {
        headers: { 'X-Inertia': 'true', 'X-Inertia-Version': 'v1' },
      })

      const body = (await res.json()) as {
        props: Record<string, unknown>
        mergeProps?: string[]
        prependProps?: string[]
        deepMergeProps?: string[]
        matchPropsOn?: string[]
      }
      expect(body.props).toEqual({
        posts: [{ id: 1 }],
        notifications: [{ id: 9 }],
        conversations: { data: [{ id: 1 }] },
      })
      expect(body.mergeProps).toEqual(['posts'])
      expect(body.prependProps).toEqual(['notifications'])
      expect(body.deepMergeProps).toEqual(['conversations'])
      expect(body.matchPropsOn).toEqual(['posts.id', 'notifications.id', 'conversations.data.id'])
    })

    it('still emits mergeProps on partial reloads so the client can keep combining', async () => {
      const app = new Hono()
      app.use(inertia({ version: 'v1' }))
      app.get('/', (c) =>
        c.render('Feed', {
          posts: merge([{ id: 3 }], { matchOn: 'id' }),
          user: { id: 1 },
        })
      )

      const res = await app.request('/', { headers: partialHeaders('Feed', 'posts') })

      const body = (await res.json()) as {
        props: Record<string, unknown>
        mergeProps?: string[]
        matchPropsOn?: string[]
      }
      expect(body.props).toEqual({ posts: [{ id: 3 }] })
      expect(body.mergeProps).toEqual(['posts'])
      expect(body.matchPropsOn).toEqual(['posts.id'])
    })

    it('omits a merge-marked prop from mergeProps when the partial filter excludes it', async () => {
      const app = new Hono()
      app.use(inertia({ version: 'v1' }))
      app.get('/', (c) =>
        c.render('Feed', {
          posts: merge([{ id: 3 }], { matchOn: 'id' }),
          notifications: prepend([{ id: 9 }], { matchOn: 'id' }),
        })
      )

      const res = await app.request('/', { headers: partialHeaders('Feed', 'posts') })

      const body = (await res.json()) as {
        props: Record<string, unknown>
        mergeProps?: string[]
        prependProps?: string[]
        matchPropsOn?: string[]
      }
      expect(body.props).toEqual({ posts: [{ id: 3 }] })
      expect(body.mergeProps).toEqual(['posts'])
      expect(body.prependProps).toBeUndefined()
      expect(body.matchPropsOn).toEqual(['posts.id'])
    })

    it('omits all merge fields from the page object when no prop is merge-marked', async () => {
      const app = new Hono()
      app.use(inertia({ version: 'v1' }))
      app.get('/', (c) => c.render('Home', { user: { id: 1 } }))

      const res = await app.request('/', {
        headers: { 'X-Inertia': 'true', 'X-Inertia-Version': 'v1' },
      })

      const body = (await res.json()) as {
        mergeProps?: string[]
        prependProps?: string[]
        deepMergeProps?: string[]
        matchPropsOn?: string[]
      }
      expect(body.mergeProps).toBeUndefined()
      expect(body.prependProps).toBeUndefined()
      expect(body.deepMergeProps).toBeUndefined()
      expect(body.matchPropsOn).toBeUndefined()
    })

    it('embeds mergeProps and matchPropsOn in the initial HTML page object', async () => {
      const app = new Hono()
      app.use(inertia({ version: 'v1' }))
      app.get('/', (c) =>
        c.render('Feed', {
          posts: merge([{ id: 1 }], { matchOn: 'id' }),
        })
      )

      const res = await app.request('/')

      const html = await res.text()
      expect(html).toContain('"mergeProps":["posts"]')
      expect(html).toContain('"matchPropsOn":["posts.id"]')
    })

    it('resolves a function value passed to merge() on partial reloads', async () => {
      const calls: string[] = []
      const app = new Hono()
      app.use(inertia({ version: 'v1' }))
      app.get('/', (c) =>
        c.render('Feed', {
          posts: merge(
            () => {
              calls.push('posts')
              return [{ id: 1 }, { id: 2 }]
            },
            { matchOn: 'id' }
          ),
        })
      )

      const res = await app.request('/', { headers: partialHeaders('Feed', 'posts') })

      expect(calls).toEqual(['posts'])
      const body = (await res.json()) as {
        props: Record<string, unknown>
        mergeProps?: string[]
        matchPropsOn?: string[]
      }
      expect(body.props).toEqual({ posts: [{ id: 1 }, { id: 2 }] })
      expect(body.mergeProps).toEqual(['posts'])
      expect(body.matchPropsOn).toEqual(['posts.id'])
    })

    it('unwraps the merge value for raw JSON requests (Accept: application/json) and skips the merge fields', async () => {
      const app = new Hono()
      app.use(inertia({ version: 'v1' }))
      app.get('/', (c) =>
        c.render('Feed', {
          posts: merge([{ id: 1 }], { matchOn: 'id' }),
        })
      )

      const res = await app.request('/', { headers: { Accept: 'application/json' } })

      // Accept: application/json returns the raw props (not a page object),
      // so the merge metadata isn't relevant — only the unwrapped value matters.
      expect(await res.json()).toEqual({ posts: [{ id: 1 }] })
    })
  })

  describe('scroll props', () => {
    const partialHeaders = (component: string, only?: string, mergeIntent?: string) => {
      const headers: Record<string, string> = {
        'X-Inertia': 'true',
        'X-Inertia-Version': 'v1',
        'X-Inertia-Partial-Component': component,
      }
      if (only !== undefined) {
        headers['X-Inertia-Partial-Data'] = only
      }
      if (mergeIntent !== undefined) {
        headers['X-Inertia-Infinite-Scroll-Merge-Intent'] = mergeIntent
      }
      return headers
    }

    it('emits page.scrollProps with paging metadata and unwraps the value', async () => {
      const app = new Hono()
      app.use(inertia({ version: 'v1' }))
      app.get('/', (c) =>
        c.render('Users/Index', {
          users: scroll({
            data: [{ id: 1 }, { id: 2 }],
            currentPage: 2,
            lastPage: 5,
            pageName: 'users_page',
          }),
        })
      )

      const res = await app.request('/', {
        headers: { 'X-Inertia': 'true', 'X-Inertia-Version': 'v1' },
      })

      const body = (await res.json()) as {
        props: Record<string, unknown>
        scrollProps?: Record<string, ScrollDescriptor>
      }
      expect(body.props).toEqual({ users: [{ id: 1 }, { id: 2 }] })
      expect(body.scrollProps).toEqual({
        users: { previousPage: 1, nextPage: 3, currentPage: 2, pageName: 'users_page' },
      })
    })

    it('reports previousPage as null on the first page', async () => {
      const app = new Hono()
      app.use(inertia({ version: 'v1' }))
      app.get('/', (c) =>
        c.render('Users/Index', {
          users: scroll({ data: [], currentPage: 1, lastPage: 5, pageName: 'page' }),
        })
      )

      const res = await app.request('/', {
        headers: { 'X-Inertia': 'true', 'X-Inertia-Version': 'v1' },
      })

      const body = (await res.json()) as { scrollProps?: Record<string, ScrollDescriptor> }
      expect(body.scrollProps?.['users']?.previousPage).toBeNull()
      expect(body.scrollProps?.['users']?.nextPage).toBe(2)
    })

    it('reports nextPage as null on the last page', async () => {
      const app = new Hono()
      app.use(inertia({ version: 'v1' }))
      app.get('/', (c) =>
        c.render('Users/Index', {
          users: scroll({ data: [], currentPage: 5, lastPage: 5, pageName: 'page' }),
        })
      )

      const res = await app.request('/', {
        headers: { 'X-Inertia': 'true', 'X-Inertia-Version': 'v1' },
      })

      const body = (await res.json()) as { scrollProps?: Record<string, ScrollDescriptor> }
      expect(body.scrollProps?.['users']?.previousPage).toBe(4)
      expect(body.scrollProps?.['users']?.nextPage).toBeNull()
    })

    it('defaults the merge direction to append (mergeProps, not prependProps)', async () => {
      const app = new Hono()
      app.use(inertia({ version: 'v1' }))
      app.get('/', (c) =>
        c.render('Users/Index', {
          users: scroll({ data: [], currentPage: 1, lastPage: 5, pageName: 'page' }),
        })
      )

      const res = await app.request('/', {
        headers: { 'X-Inertia': 'true', 'X-Inertia-Version': 'v1' },
      })

      const body = (await res.json()) as { mergeProps?: string[]; prependProps?: string[] }
      expect(body.mergeProps).toEqual(['users'])
      expect(body.prependProps).toBeUndefined()
    })

    it('switches to prepend when X-Inertia-Infinite-Scroll-Merge-Intent is prepend', async () => {
      const app = new Hono()
      app.use(inertia({ version: 'v1' }))
      app.get('/', (c) =>
        c.render('Users/Index', {
          users: scroll({ data: [], currentPage: 2, lastPage: 5, pageName: 'page' }),
        })
      )

      const res = await app.request('/', {
        headers: partialHeaders('Users/Index', 'users', 'prepend'),
      })

      const body = (await res.json()) as { mergeProps?: string[]; prependProps?: string[] }
      expect(body.prependProps).toEqual(['users'])
      expect(body.mergeProps).toBeUndefined()
    })

    it('treats an unknown merge-intent value (e.g. "append" or garbage) as append', async () => {
      const app = new Hono()
      app.use(inertia({ version: 'v1' }))
      app.get('/', (c) =>
        c.render('Users/Index', {
          users: scroll({ data: [], currentPage: 2, lastPage: 5, pageName: 'page' }),
        })
      )

      const res = await app.request('/', {
        headers: partialHeaders('Users/Index', 'users', 'bogus'),
      })

      const body = (await res.json()) as { mergeProps?: string[]; prependProps?: string[] }
      expect(body.mergeProps).toEqual(['users'])
      expect(body.prependProps).toBeUndefined()
    })

    it('emits matchPropsOn for a single matchOn string', async () => {
      const app = new Hono()
      app.use(inertia({ version: 'v1' }))
      app.get('/', (c) =>
        c.render('Users/Index', {
          users: scroll({
            data: [{ id: 1 }],
            currentPage: 1,
            lastPage: 5,
            pageName: 'page',
            matchOn: 'id',
          }),
        })
      )

      const res = await app.request('/', {
        headers: { 'X-Inertia': 'true', 'X-Inertia-Version': 'v1' },
      })

      const body = (await res.json()) as { matchPropsOn?: string[] }
      expect(body.matchPropsOn).toEqual(['users.id'])
    })

    it('expands an array matchOn into one matchPropsOn entry per field', async () => {
      const app = new Hono()
      app.use(inertia({ version: 'v1' }))
      app.get('/', (c) =>
        c.render('Users/Index', {
          users: scroll({
            data: [{ id: 1, tenantId: 'a' }],
            currentPage: 1,
            lastPage: 5,
            pageName: 'page',
            matchOn: ['id', 'tenantId'],
          }),
        })
      )

      const res = await app.request('/', {
        headers: { 'X-Inertia': 'true', 'X-Inertia-Version': 'v1' },
      })

      const body = (await res.json()) as { matchPropsOn?: string[] }
      expect(body.matchPropsOn).toEqual(['users.id', 'users.tenantId'])
    })

    it('omits matchPropsOn entirely when matchOn is not passed', async () => {
      const app = new Hono()
      app.use(inertia({ version: 'v1' }))
      app.get('/', (c) =>
        c.render('Users/Index', {
          users: scroll({ data: [], currentPage: 1, lastPage: 5, pageName: 'page' }),
        })
      )

      const res = await app.request('/', {
        headers: { 'X-Inertia': 'true', 'X-Inertia-Version': 'v1' },
      })

      const body = (await res.json()) as { matchPropsOn?: string[] }
      expect(body.matchPropsOn).toBeUndefined()
    })

    it('still emits scrollProps and mergeProps on partial reloads', async () => {
      const app = new Hono()
      app.use(inertia({ version: 'v1' }))
      app.get('/', (c) =>
        c.render('Users/Index', {
          users: scroll({
            data: [{ id: 11 }],
            currentPage: 2,
            lastPage: 5,
            pageName: 'page',
            matchOn: 'id',
          }),
          tenant: { id: 1 },
        })
      )

      const res = await app.request('/', { headers: partialHeaders('Users/Index', 'users') })

      const body = (await res.json()) as {
        props: Record<string, unknown>
        scrollProps?: Record<string, ScrollDescriptor>
        mergeProps?: string[]
        matchPropsOn?: string[]
      }
      expect(body.props).toEqual({ users: [{ id: 11 }] })
      expect(body.scrollProps?.['users']?.currentPage).toBe(2)
      expect(body.mergeProps).toEqual(['users'])
      expect(body.matchPropsOn).toEqual(['users.id'])
    })

    it('omits a scroll-marked prop from scrollProps when the partial filter excludes it', async () => {
      const app = new Hono()
      app.use(inertia({ version: 'v1' }))
      app.get('/', (c) =>
        c.render('Feed', {
          users: scroll({
            data: [{ id: 1 }],
            currentPage: 1,
            lastPage: 5,
            pageName: 'page',
            matchOn: 'id',
          }),
          orders: scroll({
            data: [{ id: 2 }],
            currentPage: 1,
            lastPage: 3,
            pageName: 'orders_page',
            matchOn: 'id',
          }),
        })
      )

      const res = await app.request('/', { headers: partialHeaders('Feed', 'users') })

      const body = (await res.json()) as {
        props: Record<string, unknown>
        scrollProps?: Record<string, ScrollDescriptor>
        mergeProps?: string[]
        matchPropsOn?: string[]
      }
      expect(body.props).toEqual({ users: [{ id: 1 }] })
      expect(Object.keys(body.scrollProps ?? {})).toEqual(['users'])
      expect(body.mergeProps).toEqual(['users'])
      expect(body.matchPropsOn).toEqual(['users.id'])
    })

    it('supports multiple scroll() props in a single response', async () => {
      const app = new Hono()
      app.use(inertia({ version: 'v1' }))
      app.get('/', (c) =>
        c.render('Dashboard', {
          users: scroll({
            data: [],
            currentPage: 1,
            lastPage: 5,
            pageName: 'users_page',
            matchOn: 'id',
          }),
          orders: scroll({
            data: [],
            currentPage: 2,
            lastPage: 4,
            pageName: 'orders_page',
            matchOn: 'id',
          }),
        })
      )

      const res = await app.request('/', {
        headers: { 'X-Inertia': 'true', 'X-Inertia-Version': 'v1' },
      })

      const body = (await res.json()) as {
        scrollProps?: Record<string, ScrollDescriptor>
        mergeProps?: string[]
        matchPropsOn?: string[]
      }
      expect(body.scrollProps).toEqual({
        users: { previousPage: null, nextPage: 2, currentPage: 1, pageName: 'users_page' },
        orders: { previousPage: 1, nextPage: 3, currentPage: 2, pageName: 'orders_page' },
      })
      expect(body.mergeProps).toEqual(['users', 'orders'])
      expect(body.matchPropsOn).toEqual(['users.id', 'orders.id'])
    })

    it('coexists with merge() / prepend() in the same response', async () => {
      const app = new Hono()
      app.use(inertia({ version: 'v1' }))
      app.get('/', (c) =>
        c.render('Feed', {
          users: scroll({
            data: [{ id: 1 }],
            currentPage: 1,
            lastPage: 5,
            pageName: 'page',
            matchOn: 'id',
          }),
          announcements: prepend([{ id: 9 }], { matchOn: 'id' }),
          ticker: merge([{ id: 1 }], { matchOn: 'id' }),
        })
      )

      const res = await app.request('/', {
        headers: { 'X-Inertia': 'true', 'X-Inertia-Version': 'v1' },
      })

      const body = (await res.json()) as {
        mergeProps?: string[]
        prependProps?: string[]
        matchPropsOn?: string[]
        scrollProps?: Record<string, ScrollDescriptor>
      }
      expect(body.mergeProps).toEqual(['users', 'ticker'])
      expect(body.prependProps).toEqual(['announcements'])
      expect(body.matchPropsOn).toEqual(['users.id', 'announcements.id', 'ticker.id'])
      expect(body.scrollProps?.['users']?.pageName).toBe('page')
    })

    it('embeds scrollProps in the initial HTML page object', async () => {
      const app = new Hono()
      app.use(inertia({ version: 'v1' }))
      app.get('/', (c) =>
        c.render('Users/Index', {
          users: scroll({
            data: [{ id: 1 }],
            currentPage: 1,
            lastPage: 3,
            pageName: 'users_page',
            matchOn: 'id',
          }),
        })
      )

      const res = await app.request('/')

      const html = await res.text()
      expect(html).toContain('"scrollProps":{"users":')
      expect(html).toContain('"pageName":"users_page"')
      expect(html).toContain('"mergeProps":["users"]')
      expect(html).toContain('"matchPropsOn":["users.id"]')
    })

    it('omits all scroll fields from the page object when no prop is scroll-marked', async () => {
      const app = new Hono()
      app.use(inertia({ version: 'v1' }))
      app.get('/', (c) => c.render('Home', { user: { id: 1 } }))

      const res = await app.request('/', {
        headers: { 'X-Inertia': 'true', 'X-Inertia-Version': 'v1' },
      })

      const body = (await res.json()) as { scrollProps?: Record<string, ScrollDescriptor> }
      expect(body.scrollProps).toBeUndefined()
    })

    it('unwraps the scroll value for raw JSON requests (Accept: application/json)', async () => {
      const app = new Hono()
      app.use(inertia({ version: 'v1' }))
      app.get('/', (c) =>
        c.render('Users/Index', {
          users: scroll({
            data: [{ id: 1 }],
            currentPage: 1,
            lastPage: 3,
            pageName: 'users_page',
            matchOn: 'id',
          }),
        })
      )

      const res = await app.request('/', { headers: { Accept: 'application/json' } })

      // Accept: application/json returns the raw props (not a page object),
      // so scroll metadata isn't relevant — only the unwrapped value matters.
      expect(await res.json()).toEqual({ users: [{ id: 1 }] })
    })
  })
})
