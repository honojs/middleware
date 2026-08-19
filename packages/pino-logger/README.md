# @hono/pino-logger

Pino Logger middleware for [Hono](https://hono.dev).

Provides a request-scoped logger on `c.var.logger` (or `c.get('logger')`) with full type safety, automatic response time measurement, and native integration with request IDs.

## Install

```bash
npm install @hono/pino-logger pino
```

## Usage

```typescript
import { Hono } from 'hono'
import { pinoLogger } from '@hono/pino-logger'
import pino from 'pino'

const logger = pino()
const app = new Hono()

app.use(pinoLogger({ logger }))

app.get('/', (c) => {
  const log = c.var.logger // request-bound logger
  log.info('handling request')
  return c.text('Hello!')
})
```

### Request ID Correlation

If the `hono/request-id` middleware is registered, or an `x-request-id` header is present, a child logger with the `reqId` will automatically be bound:

```typescript
import { Hono } from 'hono'
import { requestId } from 'hono/request-id'
import { pinoLogger } from '@hono/pino-logger'
import pino from 'pino'

const logger = pino()
const app = new Hono()

app.use(requestId())
app.use(pinoLogger({ logger }))

app.get('/', (c) => {
  c.var.logger.info('this log entry includes reqId!')
  return c.text('Hello!')
})
```

### Custom Hooks

You can customize how request start and end events are logged by providing `onRequest` and `onResponse` options:

```typescript
app.use(
  pinoLogger({
    logger,
    onRequest: (log, c) => {
      log.info({ path: c.req.path }, 'Incoming Request')
    },
    onResponse: (log, c, elapsedMs) => {
      log.info({ status: c.res.status, elapsedMs }, 'Request Finished')
    },
  })
)
```

## License

MIT
