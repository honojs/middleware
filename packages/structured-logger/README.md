# @hono/structured-logger

Structured Logger middleware for [Hono](https://hono.dev).

Library agnostic: works with pino, winston, bunyan, console, or any logger that implements the `BaseLogger` interface. Zero dependencies. Provides a request scoped logger on `c.var.logger` with full type safety, automatic response time measurement, and native integration with `hono/request-id`.

## Install

```bash
npm install @hono/structured-logger
```

## Usage

### With pino

```typescript
import { Hono } from 'hono'
import { requestId } from 'hono/request-id'
import { structuredLogger } from '@hono/structured-logger'
import pino from 'pino'

const rootLogger = pino()

const app = new Hono()

app.use(requestId())
app.use(
  structuredLogger({
    createLogger: (c) => rootLogger.child({ requestId: c.var.requestId }),
  })
)

app.get('/', (c) => {
  c.var.logger.info('handling request')
  return c.text('Hello!')
})
```

### With winston

```typescript
import { Hono } from 'hono'
import { structuredLogger } from '@hono/structured-logger'
import winston from 'winston'

const rootLogger = winston.createLogger({
  /* config */
})

const app = new Hono()

app.use(
  structuredLogger({
    createLogger: (c) => rootLogger.child({ requestId: c.var.requestId }),
  })
)
```

### With console (development, zero deps)

```typescript
import { Hono } from 'hono'
import { structuredLogger } from '@hono/structured-logger'

const app = new Hono()

app.use(
  structuredLogger({
    createLogger: () => console,
  })
)
```

### Custom hooks

```typescript
import { Hono } from 'hono'
import { structuredLogger } from '@hono/structured-logger'
import pino from 'pino'

const rootLogger = pino()

const app = new Hono()

app.use(
  structuredLogger({
    createLogger: (c) => rootLogger.child({ requestId: c.var.requestId }),
    onRequest: (logger, c) => {
      logger.info(
        {
          method: c.req.method,
          path: c.req.path,
          userAgent: c.req.header('user-agent'),
        },
        'incoming request'
      )
    },
    onResponse: (logger, c, elapsedMs) => {
      logger.info(
        {
          status: c.res.status,
          elapsedMs,
          contentLength: c.res.headers.get('content-length'),
        },
        'request completed'
      )
    },
    onError: (logger, err, c) => {
      logger.error(
        {
          err,
          method: c.req.method,
          path: c.req.path,
        },
        'request failed'
      )
    },
  })
)
```

### Custom context key

If you already have a `logger` variable on your context, use `contextKey` to pick a different name:

```typescript
app.use(
  structuredLogger({
    createLogger: () => myLogger,
    contextKey: 'log',
  })
)

app.get('/', (c) => {
  c.var.log.info('hello')
  return c.text('ok')
})
```

### Type safe context

Declare the logger type on your Hono app for full type safety:

```typescript
import type { pino } from 'pino'

type Env = {
  Variables: {
    logger: pino.Logger
  }
}

const app = new Hono<Env>()
```

## API

### `structuredLogger(options)`

Returns a Hono `MiddlewareHandler`.

#### Options

| Option         | Type                                                                  | Required | Default                                                  | Description                                           |
| -------------- | --------------------------------------------------------------------- | -------- | -------------------------------------------------------- | ----------------------------------------------------- |
| `createLogger` | `(c: Context) => L`                                                   | Yes      |                                                          | Factory that creates a request scoped logger instance |
| `contextKey`   | `string`                                                              | No       | `'logger'`                                               | Key used to store the logger on `c.var`               |
| `onRequest`    | `(logger: L, c: Context) => void \| Promise<void>`                    | No       | Logs method + path at info level                         | Called before handler execution                       |
| `onResponse`   | `(logger: L, c: Context, elapsedMs: number) => void \| Promise<void>` | No       | Logs method, path, status and elapsed time at info level | Called after handler execution                        |
| `onError`      | `(logger: L, err: Error, c: Context) => void \| Promise<void>`        | No       | Logs error, method, path and status at error level       | Called when handler throws                            |

### `BaseLogger`

Minimal interface your logger must implement:

```typescript
interface BaseLogger {
  info(obj: unknown, msg?: string, ...args: unknown[]): void
  warn(obj: unknown, msg?: string, ...args: unknown[]): void
  error(obj: unknown, msg?: string, ...args: unknown[]): void
  debug(obj: unknown, msg?: string, ...args: unknown[]): void
}
```

Compatible with pino, winston, bunyan, console, and most logging libraries out of the box.

## Behavior

1. `createLogger(c)` is called once per request.
2. The logger is stored on `c.var[contextKey]`.
3. `onRequest` fires before handler execution.
4. After handler completes, `onResponse` fires with elapsed time in milliseconds (measured via `performance.now()`).
5. If the handler throws, Hono's error handler runs first, then `onError` fires (checking `c.error`). `onResponse` is skipped when an error occurred.
6. `onError` and `onResponse` are mutually exclusive per request.

## Runtime compatibility

Works on all runtimes supported by Hono: Node.js, Deno, Bun, Cloudflare Workers, AWS Lambda, Vercel Edge, Fastly Compute. No Node specific APIs used.

## License

MIT
