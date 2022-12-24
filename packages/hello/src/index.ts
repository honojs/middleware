import type { Handler } from 'hono'

export const hello = (message: string = 'Hello!'): Handler => {
  return async (c, next) => {
    await next()
    c.res.headers.append('X-Message', message)
  }
}
