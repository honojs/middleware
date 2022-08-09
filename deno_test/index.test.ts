import { sentry } from '../deno_dist/mod.ts'
import { assertEquals, Hono } from './deps.ts'

// Test just only minimal patterns.
// Because others are tested well in Cloudflare Workers environment already.

Deno.test('Sentry Middleware', async () => {
  const app = new Hono()
  app.use('/sentry/*', sentry())
  app.get('/sentry/foo', (c) => c.text('foo'))

  const res = await app.request('http://localhost/sentry/foo')
  assertEquals(res.status, 200)
})
