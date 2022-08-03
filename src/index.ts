import type { Handler } from 'hono'
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
