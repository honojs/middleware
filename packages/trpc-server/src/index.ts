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
  const bodyProps = new Set(['arrayBuffer', 'blob', 'formData', 'json', 'text'] as const)
  type BodyProp = typeof bodyProps extends Set<infer T> ? T : never
  return async (c) => {
    const canWithBody = c.req.method === 'GET' || c.req.method === 'HEAD'
    const res = fetchRequestHandler({
      ...rest,
      createContext: async (opts) => ({
        ...(createContext ? await createContext(opts, c) : {}),
        // propagate env by default
        env: c.env,
      }),
      endpoint,
      req: canWithBody
        ? c.req.raw
        : new Proxy(c.req.raw, {
            get(t, p, _r) {
              if (bodyProps.has(p as BodyProp)) {
                return () => c.req[p as BodyProp]()
              }
              return Reflect.get(t, p, t)
            },
          }),
    }).then((res) => c.newResponse(res.body, res))
    return res
  }
}
