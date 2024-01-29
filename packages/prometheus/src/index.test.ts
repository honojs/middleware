import { Hono } from 'hono'
import type { Histogram } from 'prom-client'
import { Registry } from 'prom-client'
import { prometheus } from './index'

describe('Prometheus middleware', () => {
  const app = new Hono()
  const registry = new Registry()

  app.use(
    '*',
    prometheus({
      registry,
    }).registerMetrics
  )

  app.get('/', (c) => c.text('hello'))
  app.get('/user/:id', (c) => c.text(c.req.param('id')))

  beforeEach(() => registry.resetMetrics())

  describe('configuration', () => {
    it('prefix - adds the provided prefix to the metric names', async () => {
      const app = new Hono()
      const registry = new Registry()

      app.use(
        '*',
        prometheus({
          registry,
          prefix: 'myprefix_',
        }).registerMetrics
      )

      expect(await registry.metrics()).toMatchInlineSnapshot(`
        "# HELP myprefix_http_request_duration_seconds Duration of HTTP requests in seconds
        # TYPE myprefix_http_request_duration_seconds histogram

        # HELP myprefix_http_requests_total Total number of HTTP requests
        # TYPE myprefix_http_requests_total counter
        "
      `)
    })

    it('customLabels - adds custom labels to metrics', async () => {
      const app = new Hono()
      const registry = new Registry()

      app.use(
        '*',
        prometheus({
          registry,
          metricOptions: {
            requestsTotal: {
              customLabels: {
                id: (c) => c.req.query('id') ?? 'unknown',
                contentType: (c) => c.res.headers.get('content-type') ?? 'unknown',
              },
            },
          },
        }).registerMetrics
      )

      app.get('/', (c) => c.text('hello'))

      await app.request('http://localhost/?id=123')

      expect(await registry.getSingleMetricAsString('http_requests_total')).toMatchInlineSnapshot(`
        "# HELP http_requests_total Total number of HTTP requests
        # TYPE http_requests_total counter
        http_requests_total{method="GET",route="/",status="200",ok="true",id="123",contentType="text/plain;charset=UTF-8"} 1"
      `)
    })
  })

  describe('metrics', () => {
    describe('http_requests_total', () => {
      it('increments the http_requests_total metric with the correct labels on successful responses', async () => {
        await app.request('http://localhost/')

        const { values } = await registry.getSingleMetric('http_requests_total')!.get()!

        expect(values).toEqual([
          {
            labels: {
              method: 'GET',
              route: '/',
              status: '200',
              ok: 'true',
            },
            value: 1,
          },
        ])
      })

      it('increments the http_requests_total metric with the correct labels on errors', async () => {
        await app.request('http://localhost/notfound')

        const { values } = await registry.getSingleMetric('http_requests_total')!.get()!

        expect(values).toEqual([
          {
            labels: {
              method: 'GET',
              route: '/*',
              status: '404',
              ok: 'false',
            },
            value: 1,
          },
        ])
      })
    })

    describe('http_requests_duration', () => {
      it('updates the http_requests_duration metric with the correct labels on successful responses', async () => {
        await app.request('http://localhost/')

        const { values } = await (registry.getSingleMetric(
          'http_request_duration_seconds'
        ) as Histogram)!.get()!

        const countMetric = values.find(
          (v) =>
            v.metricName === 'http_request_duration_seconds_count' &&
            v.labels.method === 'GET' &&
            v.labels.route === '/' &&
            v.labels.status === '200'
        )

        expect(countMetric?.value).toBe(1)
      })

      it('updates the http_requests_duration metric with the correct labels on errors', async () => {
        await app.request('http://localhost/notfound')

        const { values } = await (registry.getSingleMetric(
          'http_request_duration_seconds'
        ) as Histogram)!.get()!

        const countMetric = values.find(
          (v) =>
            v.metricName === 'http_request_duration_seconds_count' &&
            v.labels.method === 'GET' &&
            v.labels.route === '/*' &&
            v.labels.status === '404'
        )

        expect(countMetric?.value).toBe(1)
      })
    })
  })

  describe('metrics endpoint', () => {
    it('returns the metrics in the prometheus string format on the /metrics endpoint', async () => {
      const app = new Hono()
      const registry = new Registry()

      const { printMetrics, registerMetrics } = prometheus({
        registry,
        metricOptions: {
          requestDuration: {
            disabled: true, // Disable duration metrics to make the test result more predictable
          },
        },
      })

      app.use('*', registerMetrics)
      app.get('/', (c) => c.text('hello'))
      app.get('/metrics', printMetrics)

      await app.request('http://localhost/')

      const response = await app.request('http://localhost/metrics')

      expect(await response.text()).toMatchInlineSnapshot(`
        "# HELP http_requests_total Total number of HTTP requests
        # TYPE http_requests_total counter
        http_requests_total{method="GET",route="/",status="200",ok="true"} 1
        "
      `)
    })
  })
})
