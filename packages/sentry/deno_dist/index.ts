import type { Context, MiddlewareHandler } from 'https://deno.land/x/hono/mod.ts'
import Toucan from 'https://cdn.skypack.dev/toucan-js@2.7.0'
import type { Options as ToucanOptions } from 'https://cdn.skypack.dev/toucan-js@2.7.0'

declare module 'https://deno.land/x/hono/mod.ts' {
  interface ContextVariableMap {
    sentry: Toucan
  }
}

class MockContext implements ExecutionContext {
  passThroughOnException(): void {
    throw new Error('Method not implemented.')
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async waitUntil(promise: Promise<any>): Promise<void> {
    await promise
  }
}

export type Options = Omit<ToucanOptions, 'request' | 'context'>

export const sentry = (
  options?: Options,
  callback?: (sentry: Toucan) => void
): MiddlewareHandler => {
  return async (c, next) => {
    let hasExecutionContext = true
    try {
      c.executionCtx
    } catch {
      hasExecutionContext = false
    }
    const sentry = new Toucan({
      dsn: c.env?.SENTRY_DSN ?? c.env?.NEXT_PUBLIC_SENTRY_DSN,
      allowedHeaders: ['user-agent'],
      allowedSearchParams: /(.*)/,
      request: c.req.raw,
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
