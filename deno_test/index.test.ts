import { sentry } from '../deno_dist/mod.ts'
import { assertEquals, Hono } from './deps.ts'

// Test just only minimal patterns.
// Because others are tested well in Cloudflare Workers environment already.

// Mock
class Context implements ExecutionContext {
  passThroughOnException(): void {
    throw new Error('Method not implemented.')
  }
  async waitUntil(promise: Promise<any>): Promise<void> {
    await promise
  }
}

Deno.test('Sentry Middleware', async () => {
  const app = new Hono()
  app.use('/sentry/*', sentry())
  app.get('/sentry/foo', (c) => c.text('foo'))

  const req = new Request('http://localhost/sentry/foo')
  const res = await app.fetch(req, {}, new Context())
  assertEquals(res.status, 200)
})
