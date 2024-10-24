import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'

import { getSentry, sentry } from '../src'

// Mock
class Context implements ExecutionContext {
  passThroughOnException(): void {
    throw new Error('Method not implemented.')
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async waitUntil(promise: Promise<any>): Promise<void> {
    await promise
  }
}

const captureException = jest.fn()
const log = jest.fn()

jest.mock('toucan-js', () => ({
  Toucan: jest.fn().mockImplementation(() => ({ captureException, log })),
}))

const callback = jest.fn()

describe('Sentry middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const app = new Hono()

  app.use('/sentry/*', sentry(undefined, callback))
  app.get('/sentry/foo', (c) => c.text('foo'))
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  app.get('/sentry/bar', (c) => getSentry(c).log('bar') || c.text('bar'))
  app.get('/sentry/error', () => {
    throw new Error('a catastrophic error')
  })
  app.get('/sentry/http-exception/:code', (c) => {
    const statusCode = c.req.param('code')
    throw new HTTPException(parseInt(statusCode))
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

  describe('Handle HTTPExceptions through `includeStatusCodes` option', () => {
    it('Should only report HTTPExceptions of range 500-599 if `includeStatusCodes` is not provided', async () => {
      const req = new Request('http://localhost/sentry/http-exception/500')
      const res = await app.fetch(req, {}, new Context())
      expect(res).not.toBeNull()
      expect(res.status).toBe(500)
      expect(captureException).toHaveBeenCalled()
    })

    it('Should not report HTTPExceptions other than range 500-599 if `includeStatusCodes` is not provided', async () => {
      const req = new Request('http://localhost/sentry/http-exception/400')
      const res = await app.fetch(req, {}, new Context())
      expect(res).not.toBeNull()
      expect(res.status).toBe(400)
      expect(captureException).not.toHaveBeenCalled()
    })

    const app2 = new Hono()

    app2.use('/sentry/*', sentry({ includeStatusCodes: [403, { min: 500, max: 599 }] }, callback))
    app2.get('/sentry/http-exception/:code', (c) => {
      const statusCode = c.req.param('code')
      throw new HTTPException(parseInt(statusCode))
    })

    it('Should report HTTPException if status code is included', async () => {
      const req = new Request('http://localhost/sentry/http-exception/403')
      const res = await app2.fetch(req, {}, new Context())
      expect(res).not.toBeNull()
      expect(res.status).toBe(403)
      expect(captureException).toHaveBeenCalled()
    })

    it('Should report HTTPException if status code is included', async () => {
      const req = new Request('http://localhost/sentry/http-exception/500')
      const res = await app2.fetch(req, {}, new Context())
      expect(res).not.toBeNull()
      expect(res.status).toBe(500)
      expect(captureException).toHaveBeenCalled()
    })

    it('Should not report HTTPException if status code is not included', async () => {
      const req = new Request('http://localhost/sentry/http-exception/401')
      const res = await app.fetch(req, {}, new Context())
      expect(res).not.toBeNull()
      expect(res.status).toBe(401)
      expect(captureException).not.toHaveBeenCalled()
    })

    describe('Empty `includeStatusCodes` array', () => {
      const app3 = new Hono()

      app3.use('/sentry/*', sentry({ includeStatusCodes: [] }, callback))
      app3.get('/sentry/http-exception/:code', (c) => {
        const statusCode = c.req.param('code')
        throw new HTTPException(parseInt(statusCode))
      })

      it('Ignores all HTTPExceptions for status code 400', async () => {
        const req = new Request('http://localhost/sentry/http-exception/400')
        const res = await app3.fetch(req, {}, new Context())
        expect(res).not.toBeNull()
        expect(res.status).toBe(400)
        expect(captureException).not.toHaveBeenCalled()
      })

      it('Ignores all HTTPExceptions for status code 500', async () => {
        const req = new Request('http://localhost/sentry/http-exception/500')
        const res = await app3.fetch(req, {}, new Context())
        expect(res).not.toBeNull()
        expect(res.status).toBe(500)
        expect(captureException).not.toHaveBeenCalled()
      })
    })
  })
})
