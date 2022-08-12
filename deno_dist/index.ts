import Toucan from 'https://cdn.skypack.dev/toucan-js@2.6.1'
import type {
  Context,
  Handler,
} from 'https://raw.githubusercontent.com/honojs/hono/v2.0.6/deno_dist/mod.ts'

declare module 'https://raw.githubusercontent.com/honojs/hono/v2.0.6/deno_dist/mod.ts' {
  interface ContextVariableMap {
    sentry: Toucan
  }
}

class MockContext implements ExecutionContext {
  passThroughOnException(): void {
    throw new Error('Method not implemented.')
  }
  async waitUntil(promise: Promise<any>): Promise<void> {
    await promise
  }
}

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
    let hasExecutionContext = true
    try {
      c.executionCtx
    } catch {
      hasExecutionContext = false
    }
    const sentry = new Toucan({
      dsn: c.env.SENTRY_DSN || c.env.NEXT_PUBLIC_SENTRY_DSN,
      allowedHeaders: ['user-agent'],
      allowedSearchParams: /(.*)/,
      request: c.req,
      context: hasExecutionContext ? c.executionCtx : new MockContext(),
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

export const getSentry = (c: Context) => {
  return c.get('sentry')
}
