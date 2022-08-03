import type { Handler } from 'https://raw.githubusercontent.com/honojs/hono/v2.0.6/deno_dist/mod.ts'

export const hello = (message: string = 'Hello'): Handler => {
  return async (c, next) => {
    await next()
    c.res.headers.append('X-Message', message)
  }
}
