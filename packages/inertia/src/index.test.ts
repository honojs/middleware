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
      expect(res.headers.get('content-type')).toContain('text/html')
      const html = await res.text()
      expect(html).toContain('<!DOCTYPE html>')
      expect(html).toContain('id="app"')
      expect(html).toContain('data-page=')
      expect(html).toContain('&quot;component&quot;:&quot;Home&quot;')
      expect(html).toContain('&quot;message&quot;:&quot;hello&quot;')
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

    it('escapes HTML in the embedded page object to prevent attribute breakout', async () => {
      const app = new Hono()
      app.use(inertia())
      app.get('/', (c) => c.render('Home', { evil: '"><script>x</script>' }))

      const res = await app.request('/')
      const html = await res.text()

      expect(html).not.toContain('"><script>')
      expect(html).toContain('&quot;&gt;&lt;script&gt;')
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
      expect(res.headers.get('Vary')).toBe('X-Inertia')
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
})
