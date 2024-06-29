import { initTRPC } from '@trpc/server'
import { Hono } from 'hono'
import { trpcServer } from '../src'

describe('tRPC Adapter Middleware passing synchronous Context', () => {
  type Env = {
    NAME: string
  }
  type HonoContext = {
    env: Env
    batch: string
  }

  const t = initTRPC.context<HonoContext>().create()

  const publicProcedure = t.procedure.use(
    t.middleware((opts) => {
      return opts.next({
        ctx: {
          // add .env into context, simulating a middleware as cloudflare pages
          env: {
            DB: {
              getName: () => 'World',
            },
          },
        },
      })
    })
  )
  const router = t.router

  const appRouter = router({
    hello: publicProcedure.query(({ ctx }) => {
      return `Hello ${ctx.env.DB.getName()}, batch is ${ctx.batch}`
    }),
  })

  const app = new Hono()

  app.use(
    '/trpc/*',
    trpcServer({
      router: appRouter,
      // optional createContext, additional `c` arg with the hono context
      createContext: (_opts, c) => ({
        batch: c.req.query('batch'),
      }),
    })
  )

  it.only('Should return 200 response', async () => {
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
          data: 'Hello World, batch is 1',
        },
      },
    ])
  })
})

describe('tRPC Adapter Middleware passing asynchronous Context', () => {
  type Env = {
    NAME: string
  }
  type HonoContext = {
    env: Env
    batch: string
  }

  const t = initTRPC.context<HonoContext>().create()

  const publicProcedure = t.procedure.use(
    t.middleware((opts) => {
      return opts.next({
        ctx: {
          // add .env into context, simulating a middleware as cloudflare pages
          env: {
            DB: {
              getName: () => 'World',
            },
          },
        },
      })
    })
  )
  const router = t.router

  const appRouter = router({
    hello: publicProcedure.query(({ ctx }) => {
      return `Hello ${ctx.env.DB.getName()}, batch is ${ctx.batch}`
    }),
  })

  const app = new Hono()

  app.use(
    '/trpc/*',
    trpcServer({
      router: appRouter,
      // optional createContext, additional `c` arg with the hono context
      createContext: async (_opts, c) => ({
        batch: c.req.query('batch'),
      }),
    })
  )

  it.only('Should return 200 response', async () => {
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
          data: 'Hello World, batch is 1',
        },
      },
    ])
  })
})
