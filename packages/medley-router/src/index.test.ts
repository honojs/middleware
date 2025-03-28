import { Hono } from 'hono'
import { MedleyRouter } from '.'

describe('Basic', () => {
  const app = new Hono({ router: new MedleyRouter() })

  app.get('/', (c) => c.text('Hello'))

  it('Should return a 200 response', async () => {
    const res = await app.request('/')
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
  })
})
