import { Hono } from 'hono'
import { sentry } from '../src'

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
    const res = await app.request('http://localhost/sentry/foo')
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
  })

  it('Should report errors', async () => {
    const res = await app.request('http://localhost/sentry/error')
    expect(res).not.toBeNull()
    expect(res.status).toBe(500)
    expect(captureException).toHaveBeenCalled()
  })
})
