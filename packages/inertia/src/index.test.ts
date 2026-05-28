import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import type { PageObject } from './index'
import { inertia } from './index'

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
})
