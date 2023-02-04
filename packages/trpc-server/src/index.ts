import type { AnyRouter } from '@trpc/server'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import type { MiddlewareHandler } from 'hono'

type tRPCOptions = {
  endpoint?: string
  router: AnyRouter
}

export const trpcServer = ({ router, endpoint = '/trpc' }: tRPCOptions): MiddlewareHandler => {
  return async (c) => {
    const res = fetchRequestHandler({
      endpoint: endpoint,
      req: c.req,
      router: router,
    })
    return res
  }
}
