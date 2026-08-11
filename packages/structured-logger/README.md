# @hono/structured-logger

Structured Logger middleware for [Hono](https://hono.dev).

Library agnostic: works with pino, winston, bunyan, console, or any structured logging library. Zero dependencies. Provides a request scoped logger on `c.var.logger` with full type safety, automatic response time measurement, and native integration with `hono/request-id`.

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
    onRequest: (logger, c) =>
      logger.info({ method: c.req.method, path: c.req.path }, 'incoming request'),
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

const rootLogger = winston.createLogger({/* config */})

const app = new Hono()

app.use(
  structuredLogger({
    createLogger: (c) => rootLogger.child({ requestId: c.var.requestId }),
    onRequest: (logger, c) =>
      logger.info({ method: c.req.method, path: c.req.path }, 'incoming request'),
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
    onRequest: (_logger, c) => console.info(c.req.method, c.req.path),
  })
)
```

### Skipping routes

Pass a `skip` function to opt specific requests out of logging entirely. Called before `createLogger`, so skipped requests incur no logger allocation:

```typescript
import { Hono } from 'hono'
import { structuredLogger } from '@hono/structured-logger'

const app = new Hono()

app.use(
  structuredLogger({
    createLogger: () => console,
    skip: (c) => c.req.path === '/health',
    onRequest: (_logger, c) => console.info(c.req.method, c.req.path),
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
    onError: (logger, err, c, elapsedMs) => {
      logger.error(
        {
          err,
          method: c.req.method,
          path: c.req.path,
          elapsedMs,
        },
        'request failed'
      )
    },
  })
)
```

### Custom context key

If you already have a `logger` variable on your context, use `contextKey` to pick a different name. Pass the same key to `StructuredLoggerEnv` to keep `c.var` fully typed:

```typescript
import { structuredLogger, type StructuredLoggerEnv } from '@hono/structured-logger'

const app = new Hono<StructuredLoggerEnv<MyLogger, 'log'>>()

app.use(
  structuredLogger({
    createLogger: () => myLogger,
    contextKey: 'log',
    onRequest: (logger, c) =>
      logger.info({ method: c.req.method, path: c.req.path }, 'incoming request'),
  })
)

app.get('/', (c) => {
  c.var.log.info('hello')
  return c.text('ok')
})
```

### Type safe context

Use `StructuredLoggerEnv` to declare the logger type on your Hono app. The second type parameter matches `contextKey` and defaults to `'logger'`:

```typescript
import type pino from 'pino'
import { structuredLogger, type StructuredLoggerEnv } from '@hono/structured-logger'

// Default key ('logger')
const app = new Hono<StructuredLoggerEnv<pino.Logger>>()

// Custom key — pass the same literal to both
const app = new Hono<StructuredLoggerEnv<pino.Logger, 'log'>>()
app.use(structuredLogger({ createLogger: ..., contextKey: 'log', onRequest: ... }))
```

`c.var.logger` (or the custom key) will then be typed as `pino.Logger` throughout the app.

To get typed access to other context variables inside `structuredLogger`, set the type argument with your app's env type:

```typescript
import type { Context } from 'hono'

type AppEnv = { Variables: { tenantId: string } }

app.use(
  structuredLogger<AppEnv>({
    createLogger: (c) => rootLogger.child({ tenantId: c.var.tenantId }),
    onRequest: (logger, c) =>
      logger.info({ method: c.req.method, path: c.req.path }, 'incoming request'),
  })
)
```

TypeScript infers `E = AppEnv` from the annotation, so the middleware's return type enforces that the app declares `tenantId` in its env.

## API

### `structuredLogger(options)`

Returns a Hono `MiddlewareHandler`.

#### Options

| Option         | Type                                                                              | Required | Default    | Description                                           |
| -------------- | --------------------------------------------------------------------------------- | -------- | ---------- | ----------------------------------------------------- |
| `createLogger` | `(c: Context) => L`                                                               | Yes      |            | Factory that creates a request scoped logger instance |
| `contextKey`   | `K extends string`                                                                | No       | `'logger'` | Key used to store the logger on `c.var`               |
| `skip`         | `(c: Context) => boolean`                                                         | No       | —          | When true, request passes through without logging     |
| `onRequest`    | `(logger: L, c: Context) => void \| Promise<void>`                                | Yes      | —          | Called before handler execution                       |
| `onResponse`   | `(logger: L, c: Context, elapsedMs: number) => void \| Promise<void>`             | No       | —          | Called after handler execution                        |
| `onError`      | `(logger: L, err: Error, c: Context, elapsedMs: number) => void \| Promise<void>` | No       | —          | Called when handler throws                            |

## Behavior

1. `createLogger(c)` is called once per request.
2. The logger is stored on `c.var[contextKey]`.
3. `onRequest` fires before handler execution.
4. After handler completes, `onResponse` fires with elapsed time in milliseconds (measured via `performance.now()` immediately after `onRequest` returns, so `elapsedMs` reflects handler duration only).
5. If the handler throws, Hono's `app.onError()` runs first to shape the response, then `onError` fires with elapsed time. By the time `onError` runs, `c.res` already holds the final response — including the correct status for `HTTPException`. `onResponse` is skipped when an error occurred.
6. `onError` and `onResponse` are mutually exclusive per request.

> [!WARNING]
> **Avoid logging in both `onError` and `app.onError()`.** Since `app.onError()` always runs before this middleware's `onError` hook, logging in both places produces a duplicate log line for every error. The recommended pattern is to log only here and keep `app.onError()` focused on shaping the response. Note that errors handled via `HTTPException` never reach the error branch of `app.onError()`, so logging there would also silently drop those.

## Runtime compatibility

Works on all runtimes supported by Hono: Node.js, Deno, Bun, Cloudflare Workers, AWS Lambda, Vercel Edge, Fastly Compute. No Node specific APIs used.

## License

MIT
