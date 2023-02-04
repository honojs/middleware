import { Hono } from 'hono'
import { sentry, getSentry } from '../src'

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
const log = jest.fn()
jest.mock('toucan-js', () => jest.fn().mockImplementation(() => ({ captureException, log })))
const callback = jest.fn()

describe('Sentry middleware', () => {
  const app = new Hono()

  app.use('/sentry/*', sentry(undefined, callback))
  app.get('/sentry/foo', (c) => c.text('foo'))
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  app.get('/sentry/bar', (c) => getSentry(c).log('bar') || c.text('bar'))
  app.get('/sentry/error', () => {
    throw new Error('a catastrophic error')
  })

  it('Should initialize Toucan', async () => {
    const req = new Request('http://localhost/sentry/foo')
    const res = await app.fetch(req, {}, new Context())
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(callback).toHaveBeenCalled()
  })

  it('Should make Sentry available via context', async () => {
    const req = new Request('http://localhost/sentry/bar')
    const res = await app.fetch(req, {}, new Context())
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(log).toHaveBeenCalled()
  })

  it('Should report errors', async () => {
    const req = new Request('http://localhost/sentry/error')
    const res = await app.fetch(req, {}, new Context())
    expect(res).not.toBeNull()
    expect(res.status).toBe(500)
    expect(captureException).toHaveBeenCalled()
  })
})
