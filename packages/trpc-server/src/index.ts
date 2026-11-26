import type { AnyRouter, CreateContextCallback, inferRouterContext } from '@trpc/server'
import type {
  FetchCreateContextFnOptions,
  FetchHandlerRequestOptions,
} from '@trpc/server/adapters/fetch'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import type { Context, MiddlewareHandler } from 'hono'
import { routePath } from 'hono/route'

type MaybePromise<T> = T | Promise<T>

const BODY_METHODS = new Set(['arrayBuffer', 'blob', 'formData', 'json', 'text'] as const)
type BodyMethod = typeof BODY_METHODS extends Set<infer T> ? T : never

/**
 * Hono's `HonoRequest` caches parsed bodies. If an upstream middleware has
 * already consumed `c.req.json()` (or similar), the raw `c.req.raw.body`
 * stream is locked and reading the body off `c.req.raw` throws. For request
 * methods that can carry a body we proxy body reads back through `c.req`,
 * which returns the cached value.
 */
const resolveRequest = (c: Context): Request => {
  const isBodyless = c.req.method === 'GET' || c.req.method === 'HEAD'
  if (isBodyless) {
    return c.req.raw
  }
  return new Proxy(c.req.raw, {
    get(target, prop, _receiver) {
      if (BODY_METHODS.has(prop as BodyMethod)) {
        return () => c.req[prop as BodyMethod]()
      }
      return Reflect.get(target, prop, target) as unknown
    },
  })
}

type LegacyPartialContext<T> = { [K in keyof T]?: T[K] | undefined }

type tRPCOptions<TRouter extends AnyRouter> = Omit<
  FetchHandlerRequestOptions<TRouter>,
  'req' | 'endpoint' | 'createContext'
> & {
  endpoint?: string
  createContext?(
    opts: FetchCreateContextFnOptions,
    c: Context
  ): MaybePromise<LegacyPartialContext<inferRouterContext<TRouter>>>
}

export const trpcServer = <TRouter extends AnyRouter>({
  endpoint,
  createContext,
  ...rest
}: tRPCOptions<TRouter>): MiddlewareHandler => {
  return async (c) => {
    let resolvedEndpoint: string
    if (typeof endpoint === 'string') {
      resolvedEndpoint = endpoint
    } else {
      const path = routePath(c)
      resolvedEndpoint = path ? path.replace(/\/\*+$/, '') || '/trpc' : '/trpc'
    }

    const res = await fetchRequestHandler({
      ...rest,
      endpoint: resolvedEndpoint,
      req: resolveRequest(c),
      createContext: async (opts: FetchCreateContextFnOptions) => ({
        ...(createContext ? await createContext(opts, c) : {}),
        // propagate env by default
        env: c.env,
      }),
    } as unknown as FetchHandlerRequestOptions<AnyRouter>)
    return res
  }
}

export type TrpcFetchHandlerOptions<TRouter extends AnyRouter> = Omit<
  FetchHandlerRequestOptions<TRouter>,
  'req' | 'createContext'
> &
  CreateContextCallback<
    inferRouterContext<TRouter>,
    (opts: FetchCreateContextFnOptions, c: Context) => MaybePromise<inferRouterContext<TRouter>>
  >

/**
 * Hono middleware around `@trpc/server`'s `fetchRequestHandler` that
 * preserves router context inference end-to-end. `createContext` is required
 * when the router has a typed context and optional otherwise, matching
 * `fetchRequestHandler`'s own `CreateContextCallback` contract.
 *
 * Unlike `trpcServer`, this handler does not auto-merge `c.env` into the
 * context — callers that want `c.env` in their tRPC context pass it
 * explicitly from their own `createContext`, which is what allows the
 * router's context type to flow through.
 */
export const trpcFetchHandler = <TRouter extends AnyRouter>(
  options: TrpcFetchHandlerOptions<TRouter>
): MiddlewareHandler => {
  const { createContext, ...rest } = options as Omit<
    FetchHandlerRequestOptions<TRouter>,
    'req' | 'createContext'
  > & {
    createContext?: (
      opts: FetchCreateContextFnOptions,
      c: Context
    ) => MaybePromise<inferRouterContext<TRouter>>
  }
  return async (c) =>
    fetchRequestHandler<TRouter>({
      ...rest,
      req: resolveRequest(c),
      ...(createContext && {
        createContext: (fetchOpts: FetchCreateContextFnOptions) => createContext(fetchOpts, c),
      }),
    } as FetchHandlerRequestOptions<TRouter>)
}
