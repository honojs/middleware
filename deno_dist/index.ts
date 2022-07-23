import { Context, Next, Handler } from 'https://raw.githubusercontent.com/honojs/hono/v2.0.2/deno_dist/mod.ts'

export const hello = (message: string = 'Hello'): Handler => {
  return async (c: Context, next: Next) => {
    await next()
    c.res.headers.append('X-Message', message)
  }
}
