import { createMiddleware } from 'hono/factory'

export const hello = (message: string = 'Hello!') => {
  return createMiddleware(async (c, next) => {
    await next()
    c.res.headers.append('X-Message', message)
  })
}
