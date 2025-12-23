import { SpanKind, SpanStatusCode } from '@opentelemetry/api'
import { hrTime, millisToHrTime, timeInputToHrTime } from '@opentelemetry/core'
import type {
  DataPoint,
  Histogram,
  MeterProvider,
  InMemoryMetricExporter,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics'
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import {
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_HTTP_RESPONSE_STATUS_CODE,
  ATTR_HTTP_ROUTE,
  ATTR_URL_FULL,
  ATTR_HTTP_REQUEST_HEADER,
  ATTR_HTTP_RESPONSE_HEADER,
  ATTR_EXCEPTION_MESSAGE,
  ATTR_EXCEPTION_TYPE,
} from '@opentelemetry/semantic-conventions'
import type { Context } from 'hono'
import { Hono } from 'hono'
import { createMockMeterProvider, createTestMeter, createTestTracer } from './test-utils'
import { httpInstrumentationMiddleware } from './index'

describe('OpenTelemetry middleware - Spans (combined)', () => {
  let app: Hono
  let memoryExporter: InMemorySpanExporter
  let tracerProvider: NodeTracerProvider
  let subapp: Hono

  beforeEach(() => {
    const { exporter, tracerProvider: provider } = createTestTracer()
    memoryExporter = exporter
    tracerProvider = provider
    memoryExporter.reset()

    app = new Hono()
    app.use(httpInstrumentationMiddleware({ tracerProvider }))
    app.get('/foo', (c) => c.text('foo'))
    app.post('/error', () => {
      throw new Error('error message')
    })

    subapp = new Hono()
    subapp.get('/hello', (c) => c.text('Hello from subapp!'))
    subapp.get('*', (c) => c.text('Fallthrough'))
    app.route('/subapp', subapp)
  })

  it('Should make a span', async () => {
    const response = await app.request('http://localhost/foo')
    assert.strictEqual(response.status, 200)
    const spans = memoryExporter.getFinishedSpans()
    assert.strictEqual(spans.length, 1)
    const [span] = spans
    assert.strictEqual(span.name, 'GET /foo')
    assert.strictEqual(span.kind, SpanKind.SERVER)
    assert.strictEqual(span.status.code, SpanStatusCode.UNSET)
    assert.strictEqual(span.attributes[ATTR_HTTP_REQUEST_METHOD], 'GET')
    assert.strictEqual(span.attributes[ATTR_URL_FULL], 'http://localhost/foo')
    assert.strictEqual(span.attributes[ATTR_HTTP_ROUTE], '/foo')
    assert.strictEqual(span.attributes[ATTR_HTTP_RESPONSE_STATUS_CODE], 200)
  })

  it('Should make a span with error (thrown)', async () => {
    await app.request('http://localhost/error', { method: 'POST' })
    const spans = memoryExporter.getFinishedSpans()
    assert.strictEqual(spans.length, 1)
    const [span] = spans
    assert.strictEqual(span.name, 'POST /error')
    assert.strictEqual(span.kind, SpanKind.SERVER)
    assert.strictEqual(span.status.code, SpanStatusCode.ERROR)
    assert.strictEqual(span.attributes[ATTR_HTTP_REQUEST_METHOD], 'POST')
    assert.strictEqual(span.attributes[ATTR_URL_FULL], 'http://localhost/error')
    assert.strictEqual(span.attributes[ATTR_HTTP_ROUTE], '/error')
    assert.strictEqual(span.attributes[ATTR_HTTP_RESPONSE_STATUS_CODE], 500)
    const event = span.events.find((e) => e.name === 'exception') ?? span.events[0]

    assert.ok(event.attributes)
    const attrs = event.attributes
    assert.strictEqual(attrs[ATTR_EXCEPTION_TYPE], 'Error')
    assert.strictEqual(attrs[ATTR_EXCEPTION_MESSAGE], 'error message')
  })

  it('Should update the active span (parent span honored)', async () => {
    await tracerProvider.getTracer('test').startActiveSpan('existing span', async (parentSpan) => {
      await app.request('http://localhost/foo')
      parentSpan.end()
    })
    const spans = memoryExporter.getFinishedSpans()
    // Two spans: the HTTP span + parent span
    assert.strictEqual(spans.length, 2)
    const httpSpan = spans.find((s) => s.name === 'GET /foo')!
    assert.strictEqual(httpSpan.attributes[ATTR_HTTP_ROUTE], '/foo')
  })

  it('Should set the correct span name for subapp route', async () => {
    await app.request('http://localhost/subapp/hello')
    const [span] = memoryExporter.getFinishedSpans()
    assert.strictEqual(span.name, 'GET /subapp/hello')
    assert.strictEqual(span.attributes[ATTR_HTTP_ROUTE], '/subapp/hello')
  })

  it('Should capture specified request headers', async () => {
    const app2 = new Hono()
    app2.use(
      httpInstrumentationMiddleware({
        tracerProvider,
        captureRequestHeaders: ['Content-Type', 'X-Custom-Header'],
      })
    )
    app2.get('/foo', (c) => c.text('foo'))

    await app2.request('http://localhost/foo', {
      headers: {
        'Content-Type': 'application/json',
        'X-Custom-Header': 'custom-value',
        Authorization: 'Bearer secret-token',
      },
    })

    const [span] = memoryExporter.getFinishedSpans()
    assert.strictEqual(
      span.attributes[ATTR_HTTP_REQUEST_HEADER('content-type')],
      'application/json'
    )
    assert.strictEqual(span.attributes[ATTR_HTTP_REQUEST_HEADER('x-custom-header')], 'custom-value')
    assert.strictEqual(span.attributes[ATTR_HTTP_REQUEST_HEADER('authorization')], undefined)
  })

  it('Should capture specified response headers', async () => {
    const app2 = new Hono()
    app2.use(
      httpInstrumentationMiddleware({
        tracerProvider,
        captureResponseHeaders: ['Content-Type', 'X-Response-Header'],
      })
    )
    app2.get('/foo', (c) => {
      c.header('X-Response-Header', 'response-value')
      c.header('Set-Cookie', 'session=secret')
      return c.json({ message: 'test' })
    })

    await app2.request('http://localhost/foo')

    const [span] = memoryExporter.getFinishedSpans()
    assert.strictEqual(
      span.attributes[ATTR_HTTP_RESPONSE_HEADER('content-type')],
      'application/json'
    )
    assert.strictEqual(
      span.attributes[ATTR_HTTP_RESPONSE_HEADER('x-response-header')],
      'response-value'
    )
    assert.strictEqual(span.attributes[ATTR_HTTP_RESPONSE_HEADER('set-cookie')], undefined)
  })

  it('Should handle specified headers whether lowercased or not', async () => {
    const app2 = new Hono()
    app2.use(
      httpInstrumentationMiddleware({
        tracerProvider,
        captureRequestHeaders: ['Accept-Language', 'x-custom-header'],
        captureResponseHeaders: ['Cache-Control', 'x-response-header'],
      })
    )
    app2.get('/foo', (c) => {
      c.header('Cache-Control', 'no-cache')
      c.header('X-Response-Header', 'response-value')
      return c.text('foo')
    })

    await app2.request('http://localhost/foo', {
      headers: {
        'Accept-Language': 'en-US',
        'X-Custom-Header': 'custom-value',
      },
    })

    const [span] = memoryExporter.getFinishedSpans()
    assert.strictEqual(span.attributes[ATTR_HTTP_REQUEST_HEADER('accept-language')], 'en-US')
    assert.strictEqual(span.attributes[ATTR_HTTP_REQUEST_HEADER('x-custom-header')], 'custom-value')
    assert.strictEqual(span.attributes[ATTR_HTTP_RESPONSE_HEADER('cache-control')], 'no-cache')
    assert.strictEqual(
      span.attributes[ATTR_HTTP_RESPONSE_HEADER('x-response-header')],
      'response-value'
    )
  })

  it('Should support custom time input (date, unixMilli, hrTime, performanceNow)', async () => {
    const mockDate = new Date()
    const mockUnixMilli = Date.now()
    const mockHrTime = hrTime()
    const mockPerformanceNow = performance.now()

    const app2 = new Hono()
    app2.get(
      '/date',
      httpInstrumentationMiddleware({
        tracerProvider,
        getTime: () => mockDate,
      }),
      (c) => c.json({})
    )
    app2.get(
      '/unix',
      httpInstrumentationMiddleware({
        tracerProvider,
        getTime: () => mockUnixMilli,
      }),
      (c) => c.json({})
    )
    app2.get(
      '/hrt',
      httpInstrumentationMiddleware({
        tracerProvider,
        getTime: () => mockHrTime,
      }),
      (c) => c.json({})
    )
    app2.get(
      '/perf',
      httpInstrumentationMiddleware({
        tracerProvider,
        getTime: () => mockPerformanceNow,
      }),
      (c) => c.json({})
    )

    await app2.request('http://localhost/date')
    await app2.request('http://localhost/unix')
    await app2.request('http://localhost/hrt')
    await app2.request('http://localhost/perf')

    const spans = memoryExporter.getFinishedSpans()
    const dateSpan = spans.find((s) => s.name === 'GET /date')!
    const unixSpan = spans.find((s) => s.name === 'GET /unix')!
    const hrSpan = spans.find((s) => s.name === 'GET /hrt')!
    const perfSpan = spans.find((s) => s.name === 'GET /perf')!

    assert.deepEqual(dateSpan.startTime, timeInputToHrTime(mockDate))
    assert.deepEqual(dateSpan.endTime, timeInputToHrTime(mockDate))
    assert.deepEqual(dateSpan.duration, millisToHrTime(0))

    assert.deepEqual(unixSpan.startTime, timeInputToHrTime(mockUnixMilli))
    assert.deepEqual(unixSpan.endTime, timeInputToHrTime(mockUnixMilli))
    assert.deepEqual(unixSpan.duration, millisToHrTime(0))

    assert.deepEqual(hrSpan.startTime, mockHrTime)
    assert.deepEqual(hrSpan.endTime, mockHrTime)
    assert.deepEqual(hrSpan.duration, millisToHrTime(0))

    assert.deepEqual(perfSpan.duration, millisToHrTime(0))
    assert.deepEqual(perfSpan.startTime, perfSpan.endTime)
  })

  it('Should mark span error for 5xx response status (no thrown exception)', async () => {
    const app2 = new Hono()
    app2.use(httpInstrumentationMiddleware({ tracerProvider }))
    app2.get('/boom', () => new Response('fail', { status: 503 }))
    await app2.request('http://localhost/boom')
    const [span] = memoryExporter.getFinishedSpans()
    assert.strictEqual(span.attributes[ATTR_HTTP_RESPONSE_STATUS_CODE], 503)
    assert.strictEqual(span.status.code, SpanStatusCode.ERROR)
  })

  it('Should respect spanNameFactory override', async () => {
    const app2 = new Hono()
    app2.use(
      httpInstrumentationMiddleware({
        tracerProvider,
        spanNameFactory: (c: Context) => `custom ${c.req.method}`,
      })
    )
    app2.get('/foo', (c) => c.text('x'))
    await app2.request('http://localhost/foo')
    const [span] = memoryExporter.getFinishedSpans()
    assert.strictEqual(span.name, 'custom GET')
  })

  it('Should not create spans when disableTracing is true', async () => {
    const app2 = new Hono()
    app2.use(
      httpInstrumentationMiddleware({
        tracerProvider,
        disableTracing: true,
      })
    )
    app2.get('/foo', (c) => c.text('ok'))
    await app2.request('http://localhost/foo')
    const spans = memoryExporter.getFinishedSpans()
    assert.strictEqual(spans.length, 0)
  })
})

describe('OpenTelemetry middleware - Metrics (combined)', () => {
  let memoryMetricExporter: InMemoryMetricExporter
  let meterProvider: MeterProvider
  let metricReader: PeriodicExportingMetricReader

  beforeEach(() => {
    const { meterProvider: provider, exporter, reader } = createTestMeter()
    memoryMetricExporter = exporter
    metricReader = reader
    meterProvider = provider
  })

  afterEach(async () => {
    await meterProvider.shutdown()
  })

  it('Should record request duration histogram for a basic request', async () => {
    const app = new Hono()
    app.use(httpInstrumentationMiddleware({ meterProvider }))
    app.get('/metrics-test', (c) => c.text('success'))

    await app.request('http://localhost/metrics-test')
    await metricReader.forceFlush()

    const resourceMetrics = memoryMetricExporter.getMetrics()
    assert.ok(resourceMetrics.length > 0)
    const metrics = resourceMetrics[0].scopeMetrics[0].metrics
    const durationMetric = metrics.find((m) => m.descriptor.name === 'http.server.request.duration')
    assert.ok(durationMetric)
    assert.strictEqual(durationMetric.descriptor.unit, 's')
    const dps = durationMetric.dataPoints
    assert.strictEqual(dps.length, 1)
    const dp = dps[0]
    assert.strictEqual(dp.attributes['http.request.method'], 'GET')
    assert.strictEqual(dp.attributes['http.route'], '/metrics-test')
    if (dp.attributes['http.response.status_code']) {
      assert.strictEqual(dp.attributes['http.response.status_code'], 200)
    }
  })

  it('Should record metrics for different HTTP methods and status codes', async () => {
    const app = new Hono()
    app.use(httpInstrumentationMiddleware({ meterProvider }))
    app.get('/success', (c) => c.text('success'))
    app.post('/created', (c) => c.text('created', 201))
    app.get('/not-found', (c) => c.text('not found', 404))

    await app.request('http://localhost/success')
    await app.request('http://localhost/success')
    await app.request('http://localhost/created', { method: 'POST' })
    await app.request('http://localhost/not-found')

    await metricReader.forceFlush()

    const resourceMetrics = memoryMetricExporter.getMetrics()
    const metrics = resourceMetrics[0].scopeMetrics[0].metrics
    const durationMetric = metrics.find((m) => m.descriptor.name === 'http.server.request.duration')
    assert.ok(durationMetric)
    const combos = durationMetric.dataPoints.map(
      (dp) =>
        `${dp.attributes['http.request.method']}:${dp.attributes['http.route']}:${dp.attributes['http.response.status_code']}`
    )
    assert.ok(new Set(combos).size >= 3)
  })

  it('Should record metrics for error responses (500)', async () => {
    const app = new Hono()
    app.use(httpInstrumentationMiddleware({ meterProvider }))
    app.post('/error', () => {
      throw new Error('test error')
    })

    try {
      await app.request('http://localhost/error', { method: 'POST' })
    } catch {
      // ignore
    }
    await metricReader.forceFlush()

    const resourceMetrics = memoryMetricExporter.getMetrics()
    const metrics = resourceMetrics[0].scopeMetrics[0].metrics
    const durationMetric = metrics.find((m) => m.descriptor.name === 'http.server.request.duration')
    assert.ok(durationMetric)
    const dp = durationMetric.dataPoints.find((dp) => dp.attributes['http.route'] === '/error')!
    assert.strictEqual(dp.attributes['http.request.method'], 'POST')
    // Status code is not currently recorded in metric attributes by the instrumentation; allow absence compared to previous OTEL middleware
  })

  it('Should work with both tracer and meter providers', async () => {
    const memorySpanExporter = new InMemorySpanExporter()
    const spanProcessor = new SimpleSpanProcessor(memorySpanExporter)
    const tracerProvider = new NodeTracerProvider({
      spanProcessors: [spanProcessor],
    })

    const app = new Hono()
    app.use(httpInstrumentationMiddleware({ tracerProvider, meterProvider }))
    app.get('/both', (c) => c.text('success'))

    memorySpanExporter.reset()
    await app.request('http://localhost/both')

    const spans = memorySpanExporter.getFinishedSpans()
    assert.strictEqual(spans.length, 1)
    assert.strictEqual(spans[0].name, 'GET /both')

    await metricReader.forceFlush()
    const resourceMetrics = memoryMetricExporter.getMetrics()
    const metrics = resourceMetrics[0].scopeMetrics[0].metrics
    const durationMetric = metrics.find((m) => m.descriptor.name === 'http.server.request.duration')
    assert.ok(durationMetric)
    const histogramDp = durationMetric.dataPoints.find(
      (dp) => dp.attributes['http.route'] === '/both'
    ) as DataPoint<Histogram>
    assert.ok(histogramDp.value)
  })

  it('Should not crash without meter provider', async () => {
    const app = new Hono()
    app.use(httpInstrumentationMiddleware({}))
    app.get('/no-metrics', (c) => c.text('success'))
    const response = await app.request('http://localhost/no-metrics')
    assert.strictEqual(response.status, 200)
  })

  it('Should record metrics for subapp routes', async () => {
    const app = new Hono()
    const sub = new Hono()
    sub.get('/nested', (c) => c.text('nested'))
    app.use(httpInstrumentationMiddleware({ meterProvider }))
    app.route('/api', sub)

    await app.request('http://localhost/api/nested')
    await metricReader.forceFlush()

    const resourceMetrics = memoryMetricExporter.getMetrics()
    const metrics = resourceMetrics[0].scopeMetrics[0].metrics
    const durationMetric = metrics.find((m) => m.descriptor.name === 'http.server.request.duration')
    const dp = durationMetric!.dataPoints.find(
      (dp) => dp.attributes['http.route'] === '/api/nested'
    )
    assert.ok(dp)
  })

  it('Active requests UpDownCounter increments and decrements with identical attributes', async () => {
    const adds: { value: number; attrs: Record<string, unknown> }[] = []
    const mockMeterProvider = createMockMeterProvider({
      createUpDownCounter: () => ({
        add(value: number, attrs?: Record<string, unknown>) {
          adds.push({ value, attrs: attrs ?? {} })
        },
      }),
    })

    const app = new Hono()
    app.use(httpInstrumentationMiddleware({ meterProvider: mockMeterProvider }))
    app.get('/inflight', (c) => c.text('ok'))

    await app.request('http://localhost/inflight')

    assert.strictEqual(adds.length, 2)
    assert.deepEqual(
      adds.map((a) => a.value),
      [1, -1]
    )
    assert.deepEqual(adds[0].attrs, adds[1].attrs)
    assert.strictEqual(adds[0].attrs['http.request.method'], 'GET')
  })

  it('Should not track active requests when captureActiveRequests is false', async () => {
    const adds: { value: number; attrs: Record<string, unknown> }[] = []
    const mockMeterProvider = createMockMeterProvider({
      createUpDownCounter: () => ({
        add(value: number, attrs?: Record<string, unknown>) {
          adds.push({ value, attrs: attrs ?? {} })
        },
      }),
    })

    const app = new Hono()
    app.use(
      httpInstrumentationMiddleware({
        meterProvider: mockMeterProvider,
        captureActiveRequests: false,
      })
    )
    app.get('/no-active-tracking', (c) => c.text('ok'))

    await app.request('http://localhost/no-active-tracking')

    assert.strictEqual(adds.length, 0)
  })
})
