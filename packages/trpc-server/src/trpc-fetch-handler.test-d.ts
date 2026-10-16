import { initTRPC } from '@trpc/server'
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch'
import type { Context, MiddlewareHandler } from 'hono'
import { Hono } from 'hono'
import { trpcFetchHandler } from '.'

describe('trpcFetchHandler types', () => {
  type HonoContext = { userId: string }
  const t = initTRPC.context<HonoContext>().create()
  const typedRouter = t.router({
    me: t.procedure.query(({ ctx }) => ctx.userId),
  })

  const plain = initTRPC.create()
  const _plainRouter = plain.router({
    ping: plain.procedure.query(() => 'pong'),
  })

  test('createContext is required on the options type for a typed router', () => {
    type Options = Parameters<typeof trpcFetchHandler<typeof typedRouter>>[0]
    type HasRequiredCreateContext = undefined extends Options['createContext'] ? false : true
    expectTypeOf<HasRequiredCreateContext>().toEqualTypeOf<true>()
  })

  test('createContext signature enforces router context shape', () => {
    type Options = Parameters<typeof trpcFetchHandler<typeof typedRouter>>[0]
    type CreateContextFn = NonNullable<Options['createContext']>

    expectTypeOf<Parameters<CreateContextFn>>().toEqualTypeOf<
      [FetchCreateContextFnOptions, Context]
    >()
    expectTypeOf<ReturnType<CreateContextFn>>().toEqualTypeOf<HonoContext | Promise<HonoContext>>()
  })

  test('createContext is optional on the options type for a default-context router', () => {
    type Options = Parameters<typeof trpcFetchHandler<typeof _plainRouter>>[0]
    type HasOptionalCreateContext = undefined extends Options['createContext'] ? true : false
    expectTypeOf<HasOptionalCreateContext>().toEqualTypeOf<true>()
  })

  test('typed router with matching createContext produces a MiddlewareHandler', () => {
    const handler = trpcFetchHandler({
      router: typedRouter,
      endpoint: '/trpc',
      createContext: (_opts, c) => ({
        userId: c.req.header('x-user-id') ?? '',
      }),
    })
    expectTypeOf(handler).toEqualTypeOf<MiddlewareHandler>()
    new Hono().use('/trpc/*', handler)
  })
})
