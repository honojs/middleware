import type { MiddlewareHandler } from 'hono'

export const hello = (message: string = 'Hello!') => {
  return (async (c, next) => {
    await next()
    c.res.headers.append('X-Message', message)
  }) satisfies MiddlewareHandler
}
