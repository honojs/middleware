import { Hono } from 'hono'
import { trpcAdapter } from '../src'

describe('tRPC Adapter Middleware', () => {
  const app = new Hono()

  app.use('/trpc/*', trpcAdapter())
  app.get('/trpc', (c) => c.text('Here is dummy endpoint'))

  it('Should return 200 response', async () => {
    const res = await app.request('http://localhost/trpc')
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
  })
})
