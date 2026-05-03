import { initTRPC } from '@trpc/server'
import { Hono } from 'hono'
import { trpcFetchHandler } from '.'

describe('trpcFetchHandler', () => {
  type HonoContext = { userId: string }
  const t = initTRPC.context<HonoContext>().create()
  const router = t.router({
    me: t.procedure.query(({ ctx }) => `user:${ctx.userId}`),
    rename: t.procedure
      .input((v) => {
        if (typeof v !== 'string') {
          throw new Error('expected string')
        }
        return v
      })
      .mutation(({ ctx, input }) => `${ctx.userId}→${input}`),
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

  it('threads typed context through to queries', async () => {
    const res = await app.request('http://localhost/trpc/me', {
      headers: { 'x-user-id': 'alice' },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ result: { data: 'user:alice' } })
  })

  it('threads typed context through to mutations', async () => {
    const res = await app.request('http://localhost/trpc/rename', {
      method: 'POST',
      headers: {
        'x-user-id': 'alice',
        'content-type': 'application/json',
      },
      body: JSON.stringify('bob'),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ result: { data: 'alice→bob' } })
  })
})
