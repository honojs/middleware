# Prometheus middleware for Hono

This middleware adds basic [RED metrics](https://www.weave.works/blog/the-red-method-key-metrics-for-microservices-architecture/) to your Hono application, and exposes them on the `/metrics` endpoint for Prometheus to scrape.

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

## Options

An options object can be passed in the `prometheus()` middleware factory to configure the metrics:

### `prefix`

Type: *string*

Prefix all metrics with this string.

### `registry`

Type: *[Registry](https://www.npmjs.com/package/prom-client)*

A prom-client Registry instance to store the metrics. If not provided, a new one will be created.

Useful when you want to register some custom metrics while exposing them on the same `/metrics` endpoint that this middleware creates. In this case, you can create a Registry instance, register your custom metrics on that, and pass that into this option.

### `collectDefaultMetrics`

Type: *boolean | [CollectDefaultMetricsOptions](https://www.npmjs.com/package/prom-client#default-metrics)*

There are some default metrics recommended by prom-client, like event loop delay, garbage collection statistics etc.

To enable these metrics, set this option to `true`. To configure the default metrics, pass an object with the [configuration options](https://www.npmjs.com/package/prom-client#default-metrics).


### `metricOptions`

Type: *object (see below)*

Modify the standard metrics (*requestDuration* and *requestsTotal*) with any of the [Counter](https://www.npmjs.com/package/prom-client#counter) / [Histogram](https://www.npmjs.com/package/prom-client#histogram) metric options, including:

#### `customLabels`

Type: *Record<string, (context) => string>*

A record where the keys are the labels to add to the metrics, and the values are functions that receive the Hono context and return the value for that label. This is useful when adding labels to the metrics that are specific to your application or your needs. These functions are executed after all the other middlewares finished.

The following example adds a label to the *requestsTotal* metric with the `contentType` name where the value is the content type of the response:

```ts
app.use('*', prometheus({
  metricOptions: {
    requestsTotal: {
      customLabels: {
        contentType: (c) => c.res.headers.get('content-type'),
      }
    },
  }
}))
```

## Author

David Dios <https://github.com/dios-david>

## License

MIT
