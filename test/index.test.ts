import { Hono } from 'hono'
import { sentry } from '../src'

// Mock
class Context implements ExecutionContext {
  passThroughOnException(): void {
    throw new Error('Method not implemented.')
  }
  async waitUntil(promise: Promise<any>): Promise<void> {
    await promise
  }
}

const captureException = jest.fn()
jest.mock('toucan-js', () => jest.fn().mockImplementation(() => ({ captureException })))

describe('Sentry middleware', () => {
  const app = new Hono()

  app.use('/sentry/*', sentry())
  app.get('/sentry/foo', (c) => c.text('foo'))
  app.get('/sentry/error', () => {
    throw new Error('a catastrophic error')
  })

  it('Should initialize Toucan', async () => {
    const req = new Request('http://localhost/sentry/foo')
    const res = await app.fetch(req, {}, new Context())
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
  })

  it('Should report errors', async () => {
    const req = new Request('http://localhost/sentry/error')
    const res = await app.fetch(req, {}, new Context())
    expect(res).not.toBeNull()
    expect(res.status).toBe(500)
    expect(captureException).toHaveBeenCalled()
  })
})
