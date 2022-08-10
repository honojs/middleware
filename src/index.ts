import type { Handler } from 'hono'
import Toucan from 'toucan-js'

export const sentry = (): Handler => {
  return async (c, next) => {
    const sentry = new Toucan({
      dsn: c.env.SENTRY_DSN || c.env.NEXT_PUBLIC_SENTRY_DSN,
      request: c.req,
      allowedHeaders: ['user-agent'],
      allowedSearchParams: /(.*)/,
    })

    try {
      await next()
    } catch (error) {
      sentry.captureException(error)
      throw error
    }
  }
}
