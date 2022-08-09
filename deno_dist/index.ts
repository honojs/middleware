import type { Handler } from 'https://raw.githubusercontent.com/honojs/hono/v2.0.6/deno_dist/mod.ts'
import Toucan from 'toucan-js'

export const hello = (): Handler => {
  return async (c, next) => {
    const sentry = new Toucan({
      dsn: c.env.SENTRY_DSN,
      request: c.req,
      allowedHeaders: ['user-agent'],
      allowedSearchParams: /(.*)/,
    })

    try {
      await next()
    } catch (error) {
      sentry.captureException(error)
    }
  }
}
