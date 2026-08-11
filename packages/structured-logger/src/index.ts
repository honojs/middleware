/**
 * @module
 * Structured Logger Middleware for Hono.
 */

import type { Context, Env, MiddlewareHandler } from 'hono'

const defaultKey = 'logger' as const

type DefaultKey = typeof defaultKey

export type StructuredLoggerEnv<L, K extends string = DefaultKey> = Env & {
  Variables: { [P in K]: L }
}

type LoggedContext<E extends Env, L, K extends string> = Context<StructuredLoggerEnv<L, K> & E>

export interface StructuredLoggerOptions<
  E extends Env = {},
  L = unknown,
  K extends string = DefaultKey,
> {
  /**
   * Factory function that creates a request scoped logger.
   * Receives the Hono context so you can inject requestId, headers, etc.
   */
  createLogger: (c: Context<E>) => L

  /**
   * Key used to store the logger instance on c.var.
   * @default 'logger'
   */
  contextKey?: K

  /** Called before createLogger, when this returns true the request is not logged. */
  skip?: (c: Context<E>) => boolean

  /** Called after logger creation, before handler execution. */
  onRequest: (logger: L, c: LoggedContext<E, L, K>) => void | Promise<void>

  /** Called after handler execution with elapsed time in ms. */
  onResponse?: (logger: L, c: LoggedContext<E, L, K>, elapsedMs: number) => void | Promise<void>

  /** Called when an error occurs during handler execution, with elapsed time in ms. */
  onError?: (
    logger: L,
    err: Error,
    c: LoggedContext<E, L, K>,
    elapsedMs: number
  ) => void | Promise<void>
}

const now = typeof performance !== 'undefined' ? () => performance.now() : () => Date.now()

export function structuredLogger<E extends Env = {}, L = unknown, K extends string = DefaultKey>(
  options: StructuredLoggerOptions<E, L, K>
): MiddlewareHandler<E> {
  const { createLogger, contextKey = defaultKey, skip, onRequest, onResponse, onError } = options

  return async (c, next) => {
    if (skip && skip(c)) {
      return next()
    }

    const logger = createLogger(c)
    c.set(contextKey as never, logger as never)
    const ctx = c as LoggedContext<E, L, K>

    await onRequest(logger, ctx)

    const start = now()

    await next()

    const elapsed = now() - start

    if (c.error) {
      if (onError) {
        await onError(logger, c.error, ctx, elapsed)
      }
    } else if (onResponse) {
      await onResponse(logger, ctx, elapsed)
    }
  }
}
