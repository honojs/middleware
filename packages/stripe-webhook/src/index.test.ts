import { Hono } from 'hono'
import { Toucan } from 'toucan-js'
import { getSentry, sentry } from '.'

// Mock
class Context implements ExecutionContext {
  passThroughOnException(): void {
    throw new Error('Method not implemented.')
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async waitUntil(promise: Promise<any>): Promise<void> {
    await promise
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  props: any
}

vi.mock(import('toucan-js'), async (importOriginal) => {
  const original = await importOriginal()

  Object.assign(original.Toucan.prototype, { captureException: vi.fn(), log: vi.fn() })

  return original
})

const callback = vi.fn()

describe('Sentry middleware', () => {
  const app = new Hono()

  app.use('/sentry/*', sentry(undefined, callback))
  app.get('/sentry/foo', (c) => c.text('foo'))
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
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
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    expect(Toucan.prototype.log).toHaveBeenCalled()
  })

  it('Should report errors', async () => {
    const req = new Request('http://localhost/sentry/error')
    const res = await app.fetch(req, {}, new Context())
    expect(res).not.toBeNull()
    expect(res.status).toBe(500)
    expect(Toucan.prototype.captureException).toHaveBeenCalled()
  })
})
