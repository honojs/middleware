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

## Usage on Cloudflare Workers

Since @opentelemetry/sdk-node is not supported on [Cloudflare Workers](https://workers.cloudflare.com/), you need to use [@microlabs/otel-cf-workers](https://github.com/evanderkoogh/otel-cf-workers) instead.

The following example shows how to use @microlabs/otel-cf-workers with [Honeycomb](https://www.honeycomb.io/):

```ts
import { otel } from '@hono/otel'
import { instrument, ResolveConfigFn } from '@microlabs/otel-cf-workers'
import { Hono } from 'hono'

const app = new Hono()

app.use('*', otel())
app.get('/', (c) => c.text('foo'))

const config: ResolveConfigFn = (env: Env, _trigger) => {
  return {
    exporter: {
      url: 'https://api.honeycomb.io/v1/traces',
      headers: { 'x-honeycomb-team': env.HONEYCOMB_API_KEY },
    },
    service: { name: 'greetings' },
  }
}

export default instrument(app, config)
```

## Limitation

Since this instrumentation is based on Hono's middleware system, it instruments the entire request-response lifecycle. This means that it doesn't provide fine-grained instrumentation for individual middleware.

## Author

Hong Minhee <https://hongminhee.org/>

## License

MIT
