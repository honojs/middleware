import { initTRPC } from '@trpc/server'
import { Hono } from 'hono'
import { z } from 'zod'
import { trpcServer } from '../src'

describe('tRPC Adapter Middleware', () => {
  const t = initTRPC.create()

  const publicProcedure = t.procedure
  const router = t.router

  const appRouter = router({
    hello: publicProcedure.input(z.string().nullish()).query(({ input }) => {
      return `Hello ${input ?? 'World'}`
    }),
  })

  const app = new Hono()

  app.use(
    '/trpc/*',
    trpcServer({
      router: appRouter,
    })
  )

  it('Should return 200 response', async () => {
    const searchParams = new URLSearchParams({
      input: JSON.stringify({ '0': 'Hono' }),
      batch: '1',
    })
    const req = new Request(`http://localhost/trpc/hello?${searchParams.toString()}`)
    const res = await app.request(req)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([
      {
        result: {
          data: 'Hello Hono',
        },
      },
    ])
  })
})
