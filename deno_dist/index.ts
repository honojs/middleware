import type { Handler } from 'https://raw.githubusercontent.com/honojs/hono/v2.0.6/deno_dist/mod.ts'
import * as Sentry from 'https://deno.land/x/sentry_deno/main.ts'

export const sentry = (): Handler => {
  return async (c, next) => {
    Sentry.init({
      dsn: c.env.SENTRY_DSN || c.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 1.0,
    })
    try {
      await next()
    } catch (error) {
      Sentry.captureException(error)
      throw error
    }
  }
}
