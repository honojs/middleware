import type { Context, MiddlewareHandler } from 'hono'
import type { Options as ToucanOptions } from 'toucan-js'
import { Toucan } from 'toucan-js'
import { HTTPException } from 'hono/http-exception'

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

interface StatusCodeRange {
  min: number
  max: number
}

export type Options = Omit<ToucanOptions, 'request' | 'context'> & {
  /**
   * Included status codes from `HTTPException` instances to be reported to Sentry.
   *
   * example:
   * - [500] will only send events on HTTPException with status 500.
   * - [400, { min: 500, max: 599 }] will send events on HTTPException with status 400 and the status code range 500-599.
   * - [500, 503] will send events on HTTPException with status 500 and 503.
   *
   * The default is [{ min: 500, max: 599 }].
   */
  includeStatusCodes?: (number | StatusCodeRange)[]
}

const shouldCaptureHTTPException = (
  error: HTTPException,
  includeStatusCodes: Options['includeStatusCodes'] = [{ min: 500, max: 599 }]
) => {
  return includeStatusCodes.some((codeOrRange) => {
    if (typeof codeOrRange === 'number') {
      return codeOrRange === error.status
    }

    return error.status >= codeOrRange.min && error.status <= codeOrRange.max
  })
}

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
    const { includeStatusCodes, ...sentryOpts } = options ?? {}
    const sentry = new Toucan({
      dsn: c.env?.SENTRY_DSN ?? c.env?.NEXT_PUBLIC_SENTRY_DSN,
      requestDataOptions: {
        allowedHeaders: ['user-agent'],
        allowedSearchParams: /(.*)/,
      },
      request: c.req.raw,
      context: hasExecutionContext ? c.executionCtx : new MockContext(),
      ...sentryOpts,
    })
    c.set('sentry', sentry)
    if (callback) {
      callback(sentry)
    }

    await next()

    const shouldCapture =
      c.error instanceof HTTPException
        ? shouldCaptureHTTPException(c.error, includeStatusCodes)
        : !!c.error

    if (shouldCapture) {
      sentry.captureException(c.error)
    }
  }
}

export const getSentry = (c: Context) => {
  return c.get('sentry')
}
