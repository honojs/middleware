# OpenTelemetry middleware for Hono

This package provides a [Hono](https://hono.dev/) middleware that instruments your application with [OpenTelemetry](https://opentelemetry.io/).

## Usage

```ts
import { otel } from '@hono/otel'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node'
import { Hono } from 'hono'

const sdk = new NodeSDK({
  traceExporter: new ConsoleSpanExporter(),
})

sdk.start()

const app = new Hono()

app.use('*', otel())
app.get('/', (c) => c.text('foo'))

export default app
```

## Limitation

Since this instrumentation is based on Hono's middleware system, it instruments the entire request-response lifecycle. This means that it doesn't provide fine-grained instrumentation for individual middleware.

## Author

Hong Minhee <https://hongminhee.org/>

## License

MIT
