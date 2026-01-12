import { initTRPC } from '@trpc/server'
import { Hono } from 'hono'
import { z } from 'zod'
import { trpcServer } from '.'

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
    const res = await app.request(`/trpc/hello?${searchParams.toString()}`)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([
      {
        result: {
          data: 'Hello Hono',
        },
      },
    ])
  })

  it('Should auto-detect endpoint from /v1/* route', async () => {
    const app = new Hono()
    app.use('/v1/*', trpcServer({ router: appRouter }))

    const searchParams = new URLSearchParams({
      input: JSON.stringify({ '0': 'World' }),
      batch: '1',
    })
    const res = await app.request(`/v1/hello?${searchParams.toString()}`)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([{ result: { data: 'Hello World' } }])
  })

  it('Should handle short path prefixes like /v/*', async () => {
    const app = new Hono()
    app.use('/v/*', trpcServer({ router: appRouter }))

    const searchParams = new URLSearchParams({
      input: JSON.stringify({ '0': 'Test' }),
      batch: '1',
    })
    const res = await app.request(`/v/hello?${searchParams.toString()}`)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([{ result: { data: 'Hello Test' } }])
  })

  it('Should respect explicit endpoint parameter', async () => {
    const app = new Hono()
    app.use('/api/trpc/*', trpcServer({ router: appRouter, endpoint: '/api/trpc' }))

    const searchParams = new URLSearchParams({
      input: JSON.stringify({ '0': 'Explicit' }),
      batch: '1',
    })
    const res = await app.request(`/api/trpc/hello?${searchParams.toString()}`)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([{ result: { data: 'Hello Explicit' } }])
  })
})

describe('tRPC Subscription (SSE)', () => {
  const t = initTRPC.create()

  const appRouter = t.router({
    countdown: t.procedure.input(z.number()).subscription(async function* ({ input }) {
      for (let i = input; i >= 0; i--) {
        yield { count: i }
      }
    }),
  })

  const app = new Hono()
  app.use('/trpc/*', trpcServer({ router: appRouter }))

  it('Should stream SSE subscription data', async () => {
    const searchParams = new URLSearchParams({
      input: JSON.stringify(3),
    })
    const res = await app.request(`/trpc/countdown?${searchParams.toString()}`, {
      headers: {
        Accept: 'text/event-stream',
      },
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/event-stream')

    const text = await res.text()

    // Parse SSE events from text
    const events = text
      .split('\n\n')
      .filter((e) => e.trim())
      .map((block) => {
        const event: { id?: string; event?: string; data?: string } = {}
        for (const line of block.split('\n')) {
          if (line.startsWith('id:')) {
            event.id = line.slice(3).trim()
          } else if (line.startsWith('event:')) {
            event.event = line.slice(6).trim()
          } else if (line.startsWith('data:')) {
            event.data = line.slice(5).trim()
          }
        }
        return event
      })

    // tRPC SSE sends data without event type for subscription data
    // Filter events that have data with count property (actual subscription data)
    const dataEvents = events.filter(
      (e): e is { data: string } => typeof e.data === 'string' && e.data.includes('"count"')
    )
    expect(dataEvents.length).toBe(4)

    const counts = dataEvents.map((e) => (JSON.parse(e.data) as { count: number }).count)
    expect(counts).toEqual([3, 2, 1, 0])
  })
})
