import { assertNotEquals } from 'https://deno.land/std@0.148.0/testing/asserts.ts'
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
  app.get('/sentry/error', () => {
    throw new Error('a catastrophic error')
  })

  let req = new Request('http://localhost/sentry/foo')
  let res = await app.fetch(req, {}, new Context())
  assertNotEquals(res, null)
  assertEquals(res.status, 200)

  req = new Request('http://localhost/sentry/error')
  res = await app.fetch(req, {}, new Context())
  assertNotEquals(res, null)
  assertEquals(res.status, 500)
})
