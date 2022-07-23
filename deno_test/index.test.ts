import { hello } from '../deno_dist/mod.ts'
import { assertEquals, Hono } from './deps.ts'

// Test just only minimal patterns.
// Because others are tested well in Cloudflare Workers environment already.

Deno.test('Hello Middleware', async () => {
  const app = new Hono()
  app.use('/hello/*', hello())
  app.get('/hello/foo', (c) => c.text('foo'))

  let res = await app.request('http://localhost/hello/foo')
  assertEquals(res.status, 200)
  assertEquals(res.headers.get('X-Message'), 'Hello')
})
