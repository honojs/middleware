import { Hono } from 'hono'
import { sentry } from '../src'

describe('Sentry middleware', () => {
  const app = new Hono()

  app.use('/hello/*', sentry())
  app.get('/hello/foo', (c) => c.text('foo'))

  it('Should initialize Toucan', async () => {
    const res = await app.request('http://localhost/hello/foo')
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
  })
})
