# Prometheus middleware for Hono

[![codecov](https://codecov.io/github/honojs/middleware/graph/badge.svg?flag=prometheus)](https://codecov.io/github/honojs/middleware)

This middleware adds basic [RED metrics](https://www.weave.works/blog/the-red-method-key-metrics-for-microservices-architecture/) to your Hono application, and exposes them on the `/metrics` endpoint for Prometheus to scrape.

## Installation

This package depends on `prom-client`, so you need to install that as well:

```bash
npm install -S @hono/prometheus prom-client
# or
yarn add @hono/prometheus prom-client
```

## Usage

```ts
import { prometheus } from '@hono/prometheus'
import { Hono } from 'hono'

const app = new Hono()

const { printMetrics, registerMetrics } = prometheus()

app.use('*', registerMetrics)
app.get('/metrics', printMetrics)
app.get('/', (c) => c.text('foo'))

export default app
```

Making a GET request to `/metrics` returns the string representation of the metrics:

```
# HELP http_request_duration_seconds Duration of HTTP requests in seconds
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.005",method="GET",route="/",status="200",ok="true"} 2
http_request_duration_seconds_bucket{le="0.01",method="GET",route="/",status="200",ok="true"} 2
http_request_duration_seconds_bucket{le="0.025",method="GET",route="/",status="200",ok="true"} 2
http_request_duration_seconds_bucket{le="0.05",method="GET",route="/",status="200",ok="true"} 2
http_request_duration_seconds_bucket{le="0.075",method="GET",route="/",status="200",ok="true"} 2
http_request_duration_seconds_bucket{le="0.1",method="GET",route="/",status="200",ok="true"} 2
http_request_duration_seconds_bucket{le="0.25",method="GET",route="/",status="200",ok="true"} 2
http_request_duration_seconds_bucket{le="0.5",method="GET",route="/",status="200",ok="true"} 2
http_request_duration_seconds_bucket{le="0.75",method="GET",route="/",status="200",ok="true"} 2
http_request_duration_seconds_bucket{le="1",method="GET",route="/",status="200",ok="true"} 2
http_request_duration_seconds_bucket{le="2.5",method="GET",route="/",status="200",ok="true"} 2
http_request_duration_seconds_bucket{le="5",method="GET",route="/",status="200",ok="true"} 2
http_request_duration_seconds_bucket{le="7.5",method="GET",route="/",status="200",ok="true"} 2
http_request_duration_seconds_bucket{le="10",method="GET",route="/",status="200",ok="true"} 2
http_request_duration_seconds_bucket{le="+Inf",method="GET",route="/",status="200",ok="true"} 2
http_request_duration_seconds_sum{method="GET",route="/",status="200",ok="true"} 0.000251125
http_request_duration_seconds_count{method="GET",route="/",status="200",ok="true"} 2
http_request_duration_seconds_bucket{le="0.005",method="GET",route="/user/:id",status="200",ok="true"} 3
http_request_duration_seconds_bucket{le="0.01",method="GET",route="/user/:id",status="200",ok="true"} 3
http_request_duration_seconds_bucket{le="0.025",method="GET",route="/user/:id",status="200",ok="true"} 3
http_request_duration_seconds_bucket{le="0.05",method="GET",route="/user/:id",status="200",ok="true"} 3
http_request_duration_seconds_bucket{le="0.075",method="GET",route="/user/:id",status="200",ok="true"} 3
http_request_duration_seconds_bucket{le="0.1",method="GET",route="/user/:id",status="200",ok="true"} 3
http_request_duration_seconds_bucket{le="0.25",method="GET",route="/user/:id",status="200",ok="true"} 3
http_request_duration_seconds_bucket{le="0.5",method="GET",route="/user/:id",status="200",ok="true"} 3
http_request_duration_seconds_bucket{le="0.75",method="GET",route="/user/:id",status="200",ok="true"} 3
http_request_duration_seconds_bucket{le="1",method="GET",route="/user/:id",status="200",ok="true"} 3
http_request_duration_seconds_bucket{le="2.5",method="GET",route="/user/:id",status="200",ok="true"} 3
http_request_duration_seconds_bucket{le="5",method="GET",route="/user/:id",status="200",ok="true"} 3
http_request_duration_seconds_bucket{le="7.5",method="GET",route="/user/:id",status="200",ok="true"} 3
http_request_duration_seconds_bucket{le="10",method="GET",route="/user/:id",status="200",ok="true"} 3
http_request_duration_seconds_bucket{le="+Inf",method="GET",route="/user/:id",status="200",ok="true"} 3
http_request_duration_seconds_sum{method="GET",route="/user/:id",status="200",ok="true"} 0.000391333
http_request_duration_seconds_count{method="GET",route="/user/:id",status="200",ok="true"} 3

# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",route="/",status="200",ok="true"} 2
http_requests_total{method="GET",route="/user/:id",status="200",ok="true"} 3
```

## Options

An options object can be passed in the `prometheus()` middleware factory to configure the metrics:

### `prefix`

Type: _string_

Prefix all metrics with this string.

### `registry`

Type: _[Registry](https://www.npmjs.com/package/prom-client)_

A prom-client Registry instance to store the metrics. If not provided, a new one will be created.

Useful when you want to register some custom metrics while exposing them on the same `/metrics` endpoint that this middleware creates. In this case, you can create a Registry instance, register your custom metrics on that, and pass that into this option.

### `collectDefaultMetrics`

Type: _boolean | [CollectDefaultMetricsOptions](https://www.npmjs.com/package/prom-client#default-metrics)_

There are some default metrics recommended by prom-client, like event loop delay, garbage collection statistics etc.

To enable these metrics, set this option to `true`. To configure the default metrics, pass an object with the [configuration options](https://www.npmjs.com/package/prom-client#default-metrics).

### `metricOptions`

Type: _object (see below)_

Modify the standard metrics (_requestDuration_ and _requestsTotal_) with any of the [Counter](https://www.npmjs.com/package/prom-client#counter) / [Histogram](https://www.npmjs.com/package/prom-client#histogram) metric options, including:

#### `disabled`

Type: _boolean_

Disables the metric.

#### `customLabels`

Type: _Record<string, (context) => string>_

A record where the keys are the labels to add to the metrics, and the values are functions that receive the Hono context and return the value for that label. This is useful when adding labels to the metrics that are specific to your application or your needs. These functions are executed after all the other middlewares finished.

The following example adds a label to the _requestsTotal_ metric with the `contentType` name where the value is the content type of the response:

```ts
app.use(
  '*',
  prometheus({
    metricOptions: {
      requestsTotal: {
        customLabels: {
          content_type: (c) => c.res.headers.get('content-type'),
        },
      },
    },
  })
)
```

## Examples

### Adding custom metrics

If you want to expose custom metrics on the `/metrics` endpoint, you can create a [Registry](https://www.npmjs.com/package/prom-client#registry) instance and pass it to the `prometheus()` factory function using the `registry` property:

```ts
import { prometheus } from '@hono/prometheus'
import { Hono } from 'hono'
import { Counter, Registry } from 'prom-client'

const registry = new Registry()
const customCounter = new Counter({
  name: 'custom_counter',
  help: 'A custom counter',
  registers: [registry],
})

const app = new Hono()

const { printMetrics, registerMetrics } = prometheus({
  registry,
})

app.use('*', registerMetrics)
app.get('/metrics', printMetrics)
app.get('/', (c) => c.text('foo'))

export default app

// Somewhere in your application you can increment the custom counter:
customCounter.inc()
```

## Author

David Dios <https://github.com/dios-david>

## License

MIT
