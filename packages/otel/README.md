# OpenTelemetry middleware for Hono

[![codecov](https://codecov.io/github/honojs/middleware/graph/badge.svg?flag=otel)](https://codecov.io/github/honojs/middleware)

This package provides a [Hono](https://hono.dev/) middleware that instruments your application with [OpenTelemetry](https://opentelemetry.io/).

## Getting started

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
const instrumentationConfig = {
  serviceName: 'my-service',
  serviceVersion: '1.0.0',
  captureRequestHeaders: ['user-agent', 'service-name'],
}
app.use(httpInstrumentationMiddleware(instrumentationConfig))

export default app
```

## Configuration

The middleware allows further customization of several aspects of the instrumentation using the [`HttpInstrumentationConfig`](./src/types.ts#L4) type:

### Service name and version

`serviceName`, `serviceVersion`.
These are the name and version of the service that is being instrumented. They are used to create the `Resource` object that is passed to the `Tracer` and `Meter` instances.
There are no default values for these properties so if you want to set these attributes on spans you will need to pass them in the config.

### Capturing request/response headers

`captureRequestHeaders`, `captureResponseHeaders`.
This is an array of header names that should be captured as part of the span. By default, no headers are captured. The captured headers are represented as span attributes under the `http.request.header` key, `http.request.header.x-forwarded-for=["1.2.3.4", "1.2.3.5"]`.

## Advanced options

### `tracerProvider`, `meterProvider`, `tracer`

These are the OpenTelemetry SDK components that are used to create the `Tracer` and `Meter` instances. If you want to use a custom `Tracer` or `Meter` instance, you can pass them in here.

### `getTime`

The getTime function is used to get the current time for a span. The middleware uses it to set the start and end times for the span. By default this function is managed by the OpenTelemetry API, and is currently implemented as `Date.now()`.

### spanNameFactory

`spanNameFactory: (c: HonoContext) => string`
If you want to customize the name of the spans, you can pass a `spanNameFactory` function in the config.
This function will be called with the `HonoContext` object as an argument, and should return a string that will be used as the name of the span.

Be mindful that span names are actually defined by OpenTelemetry semantic conventions, and carry expactations about the format of the name.

## Usage on Cloudflare Workers

Since @opentelemetry/sdk-node is not supported on [Cloudflare Workers](https://workers.cloudflare.com/), you need to use [@microlabs/otel-cf-workers](https://github.com/evanderkoogh/otel-cf-workers) instead.

So far I have not been able to see solid support for metrics in Cloudflare Workers. Any ideas here are very welcome! Until then - the tracing instrumentation can be used!

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

Joakim Lorentz <https://github.com/mrlorentx/>
Hong Minhee <https://hongminhee.org/>

## License

MIT
