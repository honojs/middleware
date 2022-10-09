import type { Context, Handler } from 'https://raw.githubusercontent.com/honojs/hono/v2.2.5/deno_dist/mod.ts'
import Toucan from 'https://cdn.skypack.dev/toucan-js@2.6.1'

declare module 'https://raw.githubusercontent.com/honojs/hono/v2.2.5/deno_dist/mod.ts' {
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
    c.set('sentry', sentry)
    if (callback) callback(sentry)

    await next()
    if (c.error) {
      sentry.captureException(c.error)
    }
  }
}

export const getSentry = (c: Context) => {
  return c.get('sentry')
}
