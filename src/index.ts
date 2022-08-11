import type { Handler } from 'hono'
import Toucan from 'toucan-js'

export type Options = {
  dsn?: string
  allowedCookies?: string[] | RegExp
  allowedHeaders?: string[] | RegExp
  allowedSearchParams?: string[] | RegExp
  attachStacktrace?: boolean
  debug?: boolean
  environment?: string
  maxBreadcrumbs?: number
  pkg?: Record<string, any>
  release?: string
}

export const sentry = (options?: Options, callback?: (sentry: Toucan) => void): Handler => {
  return async (c, next) => {
    const sentry = new Toucan({
      dsn: c.env.SENTRY_DSN || c.env.NEXT_PUBLIC_SENTRY_DSN,
      allowedHeaders: ['user-agent'],
      allowedSearchParams: /(.*)/,
      request: c.req,
      context: c.executionCtx,
      ...options,
    })

    if (callback) callback(sentry)

    try {
      await next()
    } catch (error) {
      sentry.captureException(error)
      throw error
    }
  }
}
