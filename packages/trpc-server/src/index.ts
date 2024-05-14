import type { AnyRouter } from '@trpc/server'
import type {
  FetchCreateContextFnOptions,
  FetchHandlerRequestOptions,
} from '@trpc/server/adapters/fetch'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import type { Context, MiddlewareHandler } from 'hono'

type tRPCOptions = Omit<
  FetchHandlerRequestOptions<AnyRouter>,
  'req' | 'endpoint' | 'createContext'
> &
  Partial<Pick<FetchHandlerRequestOptions<AnyRouter>, 'endpoint'>> & {
    createContext?(
      opts: FetchCreateContextFnOptions,
      c: Context
    ): Record<string, unknown> | Promise<Record<string, unknown>>
  }

export const trpcServer = ({
  endpoint = '/trpc',
  createContext,
  ...rest
}: tRPCOptions): MiddlewareHandler => {
  return async (c) => {
    const res = fetchRequestHandler({
      ...rest,
      createContext: async (opts) => ({
        ...(createContext ? await createContext(opts, c) : {}),
        // propagate env by default
        env: c.env,
      }),
      endpoint,
      req: c.req.raw,
    }).then((res) => c.body(res.body, res))
    return res
  }
}
