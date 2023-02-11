import type { AnyRouter } from '@trpc/server'
import type { FetchHandlerRequestOptions} from '@trpc/server/adapters/fetch'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import type { MiddlewareHandler } from 'hono'

type tRPCOptions =
  Omit<
    FetchHandlerRequestOptions<AnyRouter>,
    'req' | 'endpoint'
  > & Partial<Pick<FetchHandlerRequestOptions<AnyRouter>, 'endpoint'>>

export const trpcServer = ({ endpoint = '/trpc', ...rest }: tRPCOptions): MiddlewareHandler => {
  return async (c) => {  
    const res = fetchRequestHandler({
      ...rest,
      endpoint,
      req: c.req,
    })
    return res
  }
}
