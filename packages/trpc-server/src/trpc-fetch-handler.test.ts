import { initTRPC } from '@trpc/server'
import { Hono } from 'hono'
import { trpcFetchHandler } from '.'

describe('trpcFetchHandler', () => {
  type HonoContext = { userId: string }
  const t = initTRPC.context<HonoContext>().create()
  const router = t.router({
    me: t.procedure.query(({ ctx }) => `user:${ctx.userId}`),
  })

  const app = new Hono()
  app.use(
    '/trpc/*',
    trpcFetchHandler({
      router,
      endpoint: '/trpc',
      createContext: (_opts, c) => ({
        userId: c.req.header('x-user-id') ?? 'anon',
      }),
    })
  )

  it('threads typed context through to procedures', async () => {
    const res = await app.request('http://localhost/trpc/me', {
      headers: { 'x-user-id': 'alice' },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ result: { data: 'user:alice' } })
  })
})
