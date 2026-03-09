/**
 * @module
 * Structured Logger Middleware for Hono.
 */

import type { Context, MiddlewareHandler } from 'hono'

/**
 * Minimal logger interface compatible with pino, winston, console, bunyan, etc.
 */
export interface BaseLogger {
  info(obj: unknown, msg?: string, ...args: unknown[]): void
  warn(obj: unknown, msg?: string, ...args: unknown[]): void
  error(obj: unknown, msg?: string, ...args: unknown[]): void
  debug(obj: unknown, msg?: string, ...args: unknown[]): void
}

export interface StructuredLoggerOptions<L extends BaseLogger = BaseLogger> {
  /**
   * Factory function that creates a request scoped logger.
   * Receives the Hono context so you can inject requestId, headers, etc.
   */
  createLogger: (c: Context) => L

  /**
   * Key used to store the logger instance on c.var.
   * @default 'logger'
   */
  contextKey?: string

  /**
   * Called after logger creation, before handler execution.
   * Use for logging request start, incoming headers, etc.
   * Default: logs method + path at info level.
   */
  onRequest?: (logger: L, c: Context) => void | Promise<void>

  /**
   * Called after handler execution with elapsed time in ms.
   * Use for logging response status, duration, etc.
   * Default: logs status + elapsed at info level.
   */
  onResponse?: (logger: L, c: Context, elapsedMs: number) => void | Promise<void>

  /**
   * Called when an error occurs during handler execution.
   * Default: logs error at error level.
   */
  onError?: (logger: L, err: Error, c: Context) => void | Promise<void>
}

const now =
  typeof performance !== 'undefined' ? () => performance.now() : () => Date.now()

function defaultOnRequest(logger: BaseLogger, c: Context): void {
  logger.info({ method: c.req.method, path: c.req.path }, 'request start')
}

function defaultOnResponse(logger: BaseLogger, c: Context, elapsedMs: number): void {
  logger.info({ method: c.req.method, path: c.req.path, status: c.res.status, elapsedMs }, 'request end')
}

function defaultOnError(logger: BaseLogger, err: Error, c: Context): void {
  logger.error({ err, method: c.req.method, path: c.req.path, status: c.res.status }, 'request error')
}

export function structuredLogger<L extends BaseLogger = BaseLogger>(
  options: StructuredLoggerOptions<L>
): MiddlewareHandler {
  const {
    createLogger,
    contextKey = 'logger',
    onRequest = defaultOnRequest,
    onResponse = defaultOnResponse,
    onError = defaultOnError,
  } = options

  return async (c, next) => {
    const logger = createLogger(c)
    c.set(contextKey as never, logger as never)

    const start = now()

    await onRequest(logger, c)

    await next()

    const elapsed = now() - start

    if (c.error) {
      await onError(
        logger,
        c.error instanceof Error ? c.error : new Error(String(c.error)),
        c
      )
    } else {
      await onResponse(logger, c, elapsed)
    }
  }
}
