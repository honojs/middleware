import type { Context, MiddlewareHandler } from 'hono'
import pino from 'pino'
import type { Logger } from 'pino'

declare module 'hono' {
  interface ContextVariableMap {
    logger: Logger
  }
}

export type PinoEnv = {
  Variables: {
    logger: Logger
  }
}

export interface PinoLoggerOptions {
  /**
   * The root Pino Logger instance.
   * If not provided, a default Pino logger will be created.
   */
  logger?: Logger
  /**
   * The key used to store the logger instance on c.var.
   * @default 'logger'
   */
  contextKey?: string
  /**
   * Optional custom request formatter function.
   * Fires before the handler execution.
   */
  onRequest?: (logger: Logger, c: Context) => void | Promise<void>
  /**
   * Optional custom response formatter function.
   * Fires after handler execution with the elapsed time in milliseconds.
   */
  onResponse?: (logger: Logger, c: Context, elapsedMs: number) => void | Promise<void>
}

const now = typeof performance !== 'undefined' ? () => performance.now() : () => Date.now()

const defaultOnRequest = (logger: Logger, c: Context) => {
  logger.info({
    msg: 'incoming request',
    method: c.req.method,
    path: c.req.path,
  })
}

const defaultOnResponse = (logger: Logger, c: Context, elapsedMs: number) => {
  logger.info({
    msg: 'request completed',
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    elapsedMs,
  })
}

export const pinoLogger = (opts?: PinoLoggerOptions): MiddlewareHandler => {
  const rootLogger = opts?.logger ?? pino()
  const contextKey = opts?.contextKey ?? 'logger'
  const onRequest = opts?.onRequest ?? defaultOnRequest
  const onResponse = opts?.onResponse ?? defaultOnResponse

  return async (c, next) => {
    const requestId = (c.get('requestId') as string | undefined) ?? c.req.header('x-request-id')
    const logger = rootLogger.child(requestId ? { reqId: requestId } : {})

    c.set(contextKey as never, logger as never)

    const start = now()

    if (onRequest) {
      // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
      await (onRequest(logger, c) as unknown as Promise<void>)
    }

    await next()

    const elapsedMs = now() - start

    if (onResponse) {
      // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
      await (onResponse(logger, c, elapsedMs) as unknown as Promise<void>)
    }
  }
}
