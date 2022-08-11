import type { Options as SentryOptions, StackFrame } from '@sentry/types'
import type { Handler } from 'hono'
import Toucan from 'toucan-js'

export type RewriteFrames = {
  root?: string
  iteratee?: (frame: StackFrame) => StackFrame
}

type Options = {
  dsn?: SentryOptions['dsn']
  allowedCookies?: string[] | RegExp
  allowedHeaders?: string[] | RegExp
  allowedSearchParams?: string[] | RegExp
  attachStacktrace?: SentryOptions['attachStacktrace']
  debug?: SentryOptions['debug']
  environment?: SentryOptions['environment']
  maxBreadcrumbs?: SentryOptions['maxBreadcrumbs']
  pkg?: Record<string, any>
  release?: SentryOptions['release']
  rewriteFrames?: RewriteFrames
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
