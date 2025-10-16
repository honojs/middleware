# OpenTelemetry middleware for Hono

[![codecov](https://codecov.io/github/honojs/middleware/graph/badge.svg?flag=otel)](https://codecov.io/github/honojs/middleware)

This package provides a [Hono](https://hono.dev/) middleware that instruments your application with [OpenTelemetry](https://opentelemetry.io/).

## Usage

```ts
import { NodeSDK } from '@opentelemetry/sdk-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { httpInstrumentationMiddleware } from '@hono/otel'
import { metrics } from '@opentelemetry/api'
import { Hono } from 'hono'

const openTelemetrySDK = new NodeSDK({
  traceExporter: new OTLPTraceExporter(),
})

openTelemetrySDK.start()

const app = new Hono()
app.use(httpInstrumentationMiddleware())

export default app
```

## Usage on Cloudflare Workers

Since @opentelemetry/sdk-node is not supported on [Cloudflare Workers](https://workers.cloudflare.com/), you need to use [@microlabs/otel-cf-workers](https://github.com/evanderkoogh/otel-cf-workers) instead.

So far I have not been able to see solid support for metrics in Cloudflare Workers. Any ideas here are very weolcome! Until then - the tracing instrumentation can be used!

The following example shows how to use @microlabs/otel-cf-workers with [Honeycomb](https://www.honeycomb.io/):

```ts
import { otel } from '@hono/otel'
import { instrument, ResolveConfigFn } from '@microlabs/otel-cf-workers'
import { Hono } from 'hono'

const app = new Hono()

app.use('*', httpInstrumentationMiddleware())
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

Joakim Lorentz <https://mrlorentx.dev/>
Hong Minhee <https://hongminhee.org/>

## License

MIT
