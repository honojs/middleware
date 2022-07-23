import { Context, Next, Handler } from 'hono'

export const hello = (message: string = 'Hello'): Handler => {
  return async (c: Context, next: Next) => {
    await next()
    c.res.headers.append('X-Message', message)
  }
}
