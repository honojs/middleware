import type { Context, Env, Input, MiddlewareHandler } from 'hono'
import { Toucan } from 'toucan-js'
import type { Options as ToucanOptions } from 'toucan-js'

declare module 'hono' {
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

export function sentry<E extends Env = Env, P extends string = string, I extends Input = Input>(
  options?: Options,
  callback?: (sentry: Toucan) => void
): MiddlewareHandler<E, P, I> {
  return async (c, next) => {
    let hasExecutionContext = true
    try {
      c.executionCtx
    } catch {
      hasExecutionContext = false
    }
    const sentry = new Toucan({
      dsn: c.env?.SENTRY_DSN ?? c.env?.NEXT_PUBLIC_SENTRY_DSN,
      requestDataOptions: {
        allowedHeaders: ['user-agent'],
        allowedSearchParams: /(.*)/,
      },
      request: c.req.raw,
      context: hasExecutionContext ? c.executionCtx : new MockContext(),
      ...options,
    })
    c.set('sentry', sentry)
    if (callback) {
      callback(sentry)
    }

    await next()
    if (c.error) {
      sentry.captureException(c.error)
    }
  }
}

export function getSentry<E extends Env = Env, P extends string = string, I extends Input = Input>(
  c: Context<E, P, I>
) {
  return c.get('sentry')
}
