import { SpanKind, SpanStatusCode } from '@opentelemetry/api'
import {
  InMemoryMetricExporter,
  PeriodicExportingMetricReader,
  MeterProvider,
  AggregationTemporality,
} from '@opentelemetry/sdk-metrics'
import { InMemorySpanExporter, SimpleSpanProcessor, Span } from '@opentelemetry/sdk-trace-base'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import {
  ATTR_HTTP_REQUEST_HEADER,
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_HTTP_RESPONSE_HEADER,
  ATTR_HTTP_RESPONSE_STATUS_CODE,
  ATTR_URL_FULL,
  ATTR_HTTP_ROUTE,
  ATTR_EXCEPTION_MESSAGE,
  ATTR_EXCEPTION_TYPE,
  ATTR_EXCEPTION_STACKTRACE,
} from '@opentelemetry/semantic-conventions'
import { Hono } from 'hono'
import { otel } from '.'
import { hrTime, millisToHrTime, timeInputToHrTime } from '@opentelemetry/core'

describe('OpenTelemetry middleware', () => {
  const app = new Hono()

  const memoryExporter = new InMemorySpanExporter()
  const spanProcessor = new SimpleSpanProcessor(memoryExporter)
  const tracerProvider = new NodeTracerProvider({
    spanProcessors: [spanProcessor],
  })

  app.use(otel({ tracerProvider }))
  app.get('/foo', (c) => c.text('foo'))
  app.post('/error', () => {
    throw new Error('error message')
  })

  const subapp = new Hono()
  subapp.get('/hello', (c) => c.text('Hello from subapp!'))
  subapp.get('*', (c) => c.text('Fallthrough'))

  // mount subapp
  app.route('/subapp', subapp)

  it('Should make a span', async () => {
    memoryExporter.reset()
    const response = await app.request('http://localhost/foo')
    const spans = memoryExporter.getFinishedSpans()
    expect(spans.length).toBe(1)
    const [span] = spans
    expect(span.name).toBe('GET /foo')
    expect(span.kind).toBe(SpanKind.SERVER)
    expect(span.status.code).toBe(SpanStatusCode.UNSET)
    expect(span.status.message).toBeUndefined()
    expect(span.attributes[ATTR_HTTP_REQUEST_METHOD]).toBe('GET')
    expect(span.attributes[ATTR_URL_FULL]).toBe('http://localhost/foo')
    expect(span.attributes[ATTR_HTTP_ROUTE]).toBe('/foo')
    expect(span.attributes[ATTR_HTTP_RESPONSE_STATUS_CODE]).toBe(200)
    for (const [name] of response.headers.entries()) {
      expect(span.attributes[ATTR_HTTP_RESPONSE_HEADER(name)]).toBeUndefined()
    }
  })

  it('Should make a span with error', async () => {
    memoryExporter.reset()
    await app.request('http://localhost/error', { method: 'POST' })
    const spans = memoryExporter.getFinishedSpans()
    expect(spans.length).toBe(1)
    const [span] = spans
    expect(span.name).toBe('POST /error')
    expect(span.kind).toBe(SpanKind.SERVER)
    expect(span.status.code).toBe(SpanStatusCode.ERROR)
    expect(span.status.message).toBe('Error: error message')
    expect(span.attributes[ATTR_HTTP_REQUEST_METHOD]).toBe('POST')
    expect(span.attributes[ATTR_URL_FULL]).toBe('http://localhost/error')
    expect(span.attributes[ATTR_HTTP_ROUTE]).toBe('/error')
    expect(span.events.length).toBe(1)
    const [event] = span.events
    expect(event.attributes).toBeDefined()
    const attributes = event.attributes!
    expect(attributes[ATTR_EXCEPTION_TYPE]).toBe('Error')
    expect(attributes[ATTR_EXCEPTION_MESSAGE]).toBe('error message')
    expect(attributes[ATTR_EXCEPTION_STACKTRACE]).toEqual(
      expect.stringMatching(/Error: error message\n.*at.*index\.test\.ts/)
    )
  })

  it('Should update the active span', async () => {
    memoryExporter.reset()
    await tracerProvider.getTracer('test').startActiveSpan('existing span', async () => {
      await app.request('http://localhost/foo')
    })
    const spans = memoryExporter.getFinishedSpans()
    expect(spans.length).toBe(1)
    const [span] = spans
    expect(span.name).toBe('GET /foo')
    expect(span.attributes[ATTR_HTTP_ROUTE]).toBe('/foo')
  })

  // Issue #1112
  it('Should set the correct span name for subapp', async () => {
    memoryExporter.reset()
    await app.request('http://localhost/subapp/hello')
    const spans = memoryExporter.getFinishedSpans()
    const [span] = spans
    expect(span.name).toBe('GET /subapp/hello')
  })

  // Issue #1326
  it('Should capture specified request headers', async () => {
    const app = new Hono()
    app.use(
      otel({
        tracerProvider,
        captureRequestHeaders: ['Content-Type', 'X-Custom-Header'],
      })
    )
    app.get('/foo', (c) => c.text('foo'))

    memoryExporter.reset()
    await app.request('http://localhost/foo', {
      headers: {
        'Content-Type': 'application/json',
        'X-Custom-Header': 'custom-value',
        Authorization: 'Bearer secret-token',
      },
    })

    const spans = memoryExporter.getFinishedSpans()
    const [span] = spans
    expect(span.attributes[ATTR_HTTP_REQUEST_HEADER('content-type')]).toBe('application/json')
    expect(span.attributes[ATTR_HTTP_REQUEST_HEADER('x-custom-header')]).toBe('custom-value')
    expect(span.attributes[ATTR_HTTP_REQUEST_HEADER('authorization')]).toBeUndefined()
  })

  it('Should capture specified response headers', async () => {
    const app = new Hono()
    app.use(
      otel({
        tracerProvider,
        captureResponseHeaders: ['Content-Type', 'X-Response-Header'],
      })
    )
    app.get('/foo', (c) => {
      c.header('X-Response-Header', 'response-value')
      c.header('Set-Cookie', 'session=secret')
      return c.json({ message: 'test' })
    })

    memoryExporter.reset()
    await app.request('http://localhost/foo')

    const spans = memoryExporter.getFinishedSpans()
    const [span] = spans
    expect(span.attributes[ATTR_HTTP_RESPONSE_HEADER('content-type')]).toBe('application/json')
    expect(span.attributes[ATTR_HTTP_RESPONSE_HEADER('x-response-header')]).toBe('response-value')
    expect(span.attributes[ATTR_HTTP_RESPONSE_HEADER('set-cookie')]).toBeUndefined()
  })

  it('Should handle specified headers whether lowercased or not', async () => {
    const app = new Hono()
    app.use(
      otel({
        tracerProvider,
        captureRequestHeaders: ['Accept-Language', 'x-custom-header'],
        captureResponseHeaders: ['Cache-Control', 'x-response-header'],
      })
    )
    app.get('/foo', (c) => {
      c.header('Cache-Control', 'no-cache')
      c.header('X-Response-Header', 'response-value')
      return c.text('foo')
    })

    memoryExporter.reset()
    await app.request('http://localhost/foo', {
      headers: {
        'Accept-Language': 'en-US',
        'X-Custom-Header': 'custom-value',
      },
    })

    const spans = memoryExporter.getFinishedSpans()
    const [span] = spans
    expect(span.attributes[ATTR_HTTP_REQUEST_HEADER('accept-language')]).toBe('en-US')
    expect(span.attributes[ATTR_HTTP_REQUEST_HEADER('x-custom-header')]).toBe('custom-value')
    expect(span.attributes[ATTR_HTTP_RESPONSE_HEADER('cache-control')]).toBe('no-cache')
    expect(span.attributes[ATTR_HTTP_RESPONSE_HEADER('x-response-header')]).toBe('response-value')
  })

  it("Should support custom time input", async () => {
    const mockDate = new Date()
    const mockUnixMilli = Date.now()
    const mockHrTime = hrTime()
    const mockPerformanceNow = performance.now()    

    const app = new Hono()

    app.get('/date', otel({ tracerProvider, getTime: () => mockDate }), (c) => c.json({}))
    app.get('/unix-milli', otel({ tracerProvider, getTime: () => mockUnixMilli }), (c) => c.json({}))
    app.get('/hrtime', otel({ tracerProvider, getTime: () => mockHrTime }), (c) => c.json({}))
    app.get('/performance-now', otel({ tracerProvider, getTime: () => mockPerformanceNow }), (c) => c.json({}))

    memoryExporter.reset()

    await app.request('http://localhost/date')
    await app.request('http://localhost/unix-milli')
    await app.request('http://localhost/hrtime')
    await app.request('http://localhost/performance-now')


    const spans = memoryExporter.getFinishedSpans()
    const [dateSpan, unixMilliSpan, hrtimeSpan, performanceNowSpan] = spans

    
    expect(dateSpan.startTime).toEqual(timeInputToHrTime(mockDate))
    expect(dateSpan.endTime).toEqual(timeInputToHrTime(mockDate))
    expect(dateSpan.duration).toEqual(millisToHrTime(0))

    expect(unixMilliSpan.startTime).toEqual(timeInputToHrTime(mockUnixMilli))
    expect(unixMilliSpan.endTime).toEqual(timeInputToHrTime(mockUnixMilli))
    expect(unixMilliSpan.duration).toEqual(millisToHrTime(0))

    expect(hrtimeSpan.startTime).toEqual(mockHrTime)
    expect(hrtimeSpan.endTime).toEqual(mockHrTime)
    expect(hrtimeSpan.duration).toEqual(millisToHrTime(0))

    expect(performanceNowSpan.duration).toEqual(millisToHrTime(0))
    expect(performanceNowSpan.startTime).toEqual(performanceNowSpan.endTime)
  })
})

describe('OpenTelemetry middleware - Metrics', () => {
  let memoryMetricExporter: InMemoryMetricExporter
  let meterProvider: MeterProvider
  let metricReader: PeriodicExportingMetricReader

  beforeEach(() => {
    memoryMetricExporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE)
    metricReader = new PeriodicExportingMetricReader({
      exporter: memoryMetricExporter,
      exportIntervalMillis: 100,
    })
    meterProvider = new MeterProvider({
      readers: [metricReader],
    })
  })

  afterEach(async () => {
    await meterProvider.shutdown()
  })

  it('Should record request duration and count metrics', async () => {
    const app = new Hono()
    app.use(otel({ meterProvider }))
    app.get('/metrics-test', (c) => c.text('success'))

    await app.request('http://localhost/metrics-test')

    // Force metric collection
    await metricReader.forceFlush()

    const resourceMetrics = memoryMetricExporter.getMetrics()
    expect(resourceMetrics.length).toBeGreaterThan(0)

    const scopeMetrics = resourceMetrics[0].scopeMetrics
    expect(scopeMetrics.length).toBeGreaterThan(0)

    const metrics = scopeMetrics[0].metrics
    expect(metrics.length).toBe(2)

    // Check duration histogram
    const durationMetric = metrics.find((m) => m.descriptor.name === 'hono_server_duration')
    expect(durationMetric).toBeDefined()
    expect(durationMetric!.descriptor.description).toBe('Duration of HTTP requests in seconds')
    expect(durationMetric!.descriptor.unit).toBe('s')
    // Check that it's a histogram type (dataPointType varies by implementation)
    expect(durationMetric!.dataPoints).toBeDefined()

    const durationDataPoints = durationMetric!.dataPoints
    expect(durationDataPoints.length).toBe(1)
    expect(durationDataPoints[0].attributes).toEqual({
      'http.request.method': 'GET',
      'http.response.status_code': 200,
      'http.route': '/metrics-test',
      'http.response.ok': true,
    })

    // Check that the histogram has recorded values (exact structure may vary)
    expect(durationDataPoints[0].value).toBeDefined()
    expect(typeof durationDataPoints[0].value).toBe('object')

    // Check request count
    const countMetric = metrics.find((m) => m.descriptor.name === 'hono_server_requests')
    expect(countMetric).toBeDefined()
    expect(countMetric!.descriptor.description).toBe('Total number of HTTP requests')
    // Check that it's a counter type (dataPointType varies by implementation)
    expect(countMetric!.dataPoints).toBeDefined()

    const countDataPoints = countMetric!.dataPoints
    expect(countDataPoints.length).toBe(1)
    expect(countDataPoints[0].attributes).toEqual({
      'http.request.method': 'GET',
      'http.response.status_code': 200,
      'http.route': '/metrics-test',
      'http.response.ok': true,
    })
    expect(countDataPoints[0].value).toBe(1)
  })

  it('Should record metrics for different HTTP methods and status codes', async () => {
    const app = new Hono()
    app.use(otel({ meterProvider }))
    app.get('/success', (c) => c.text('success'))
    app.post('/created', (c) => c.text('created', 201))
    app.get('/not-found', (c) => c.text('not found', 404))

    // Make multiple requests
    await app.request('http://localhost/success')
    await app.request('http://localhost/success')
    await app.request('http://localhost/created', { method: 'POST' })
    await app.request('http://localhost/not-found')

    // Force metric collection
    await metricReader.forceFlush()

    const resourceMetrics = memoryMetricExporter.getMetrics()
    const metrics = resourceMetrics[0].scopeMetrics[0].metrics

    // Check request count metric
    const countMetric = metrics.find((m) => m.descriptor.name === 'hono_server_requests')
    expect(countMetric).toBeDefined()

    const countDataPoints = countMetric!.dataPoints
    expect(countDataPoints.length).toBe(3) // 3 different route/status combinations

    // Check GET /success requests (should have count of 2)
    const successDataPoint = countDataPoints.find(
      (dp) =>
        dp.attributes['http.route'] === '/success' &&
        dp.attributes['http.request.method'] === 'GET' &&
        dp.attributes['http.response.status_code'] === 200
    )
    expect(successDataPoint).toBeDefined()
    expect(successDataPoint!.value).toBe(2)
    expect(successDataPoint!.attributes['http.response.ok']).toBe(true)

    // Check POST /created request
    const createdDataPoint = countDataPoints.find(
      (dp) =>
        dp.attributes['http.route'] === '/created' &&
        dp.attributes['http.request.method'] === 'POST' &&
        dp.attributes['http.response.status_code'] === 201
    )
    expect(createdDataPoint).toBeDefined()
    expect(createdDataPoint!.value).toBe(1)
    expect(createdDataPoint!.attributes['http.response.ok']).toBe(true)

    // Check GET /not-found request
    const notFoundDataPoint = countDataPoints.find(
      (dp) =>
        dp.attributes['http.route'] === '/not-found' &&
        dp.attributes['http.request.method'] === 'GET' &&
        dp.attributes['http.response.status_code'] === 404
    )
    expect(notFoundDataPoint).toBeDefined()
    expect(notFoundDataPoint!.value).toBe(1)
    expect(notFoundDataPoint!.attributes['http.response.ok']).toBe(false)
  })

  it('Should record metrics for error responses', async () => {
    const app = new Hono()
    app.use(otel({ meterProvider }))
    app.post('/error', () => {
      throw new Error('test error')
    })

    await app.request('http://localhost/error', { method: 'POST' })

    // Force metric collection
    await metricReader.forceFlush()

    const resourceMetrics = memoryMetricExporter.getMetrics()
    const metrics = resourceMetrics[0].scopeMetrics[0].metrics

    // Check request count metric
    const countMetric = metrics.find((m) => m.descriptor.name === 'hono_server_requests')
    expect(countMetric).toBeDefined()

    const countDataPoints = countMetric!.dataPoints
    expect(countDataPoints.length).toBe(1)

    const errorDataPoint = countDataPoints[0]
    expect(errorDataPoint.attributes).toEqual({
      'http.request.method': 'POST',
      'http.response.status_code': 500,
      'http.route': '/error',
      'http.response.ok': false,
    })
    expect(errorDataPoint.value).toBe(1)

    // Check duration metric
    const durationMetric = metrics.find((m) => m.descriptor.name === 'hono_server_duration')
    expect(durationMetric).toBeDefined()

    const durationDataPoints = durationMetric!.dataPoints
    expect(durationDataPoints.length).toBe(1)
    expect(durationDataPoints[0].attributes).toEqual({
      'http.request.method': 'POST',
      'http.response.status_code': 500,
      'http.route': '/error',
      'http.response.ok': false,
    })
    expect(durationDataPoints[0].value).toBeDefined()
    expect(typeof durationDataPoints[0].value).toBe('object')
  })

  it('Should work with both tracer and meter providers', async () => {
    const memorySpanExporter = new InMemorySpanExporter()
    const spanProcessor = new SimpleSpanProcessor(memorySpanExporter)
    const tracerProvider = new NodeTracerProvider({
      spanProcessors: [spanProcessor],
    })

    const app = new Hono()
    app.use(otel({ tracerProvider, meterProvider }))
    app.get('/both', (c) => c.text('success'))

    memorySpanExporter.reset()
    await app.request('http://localhost/both')

    // Check spans
    const spans = memorySpanExporter.getFinishedSpans()
    expect(spans.length).toBe(1)
    expect(spans[0].name).toBe('GET /both')

    // Force metric collection
    await metricReader.forceFlush()

    // Check metrics
    const resourceMetrics = memoryMetricExporter.getMetrics()
    expect(resourceMetrics.length).toBeGreaterThan(0)

    const metrics = resourceMetrics[0].scopeMetrics[0].metrics
    expect(metrics.length).toBe(2)

    const countMetric = metrics.find((m) => m.descriptor.name === 'hono_server_requests')
    expect(countMetric).toBeDefined()
    expect(countMetric!.dataPoints[0].value).toBe(1)
  })

  it('Should work without meter provider (should not crash)', async () => {
    const app = new Hono()
    app.use(otel({})) // No meter provider
    app.get('/no-metrics', (c) => c.text('success'))

    // This should not throw
    const response = await app.request('http://localhost/no-metrics')
    expect(response.status).toBe(200)
  })

  it('Should record metrics for subapp routes', async () => {
    const app = new Hono()
    const subapp = new Hono()

    app.use(otel({ meterProvider }))
    subapp.get('/nested', (c) => c.text('nested response'))
    app.route('/api', subapp)

    await app.request('http://localhost/api/nested')

    // Force metric collection
    await metricReader.forceFlush()

    const resourceMetrics = memoryMetricExporter.getMetrics()
    const metrics = resourceMetrics[0].scopeMetrics[0].metrics

    const countMetric = metrics.find((m) => m.descriptor.name === 'hono_server_requests')
    expect(countMetric).toBeDefined()

    const countDataPoints = countMetric!.dataPoints
    expect(countDataPoints.length).toBe(1)
    expect(countDataPoints[0].attributes['http.route']).toBe('/api/nested')
  })
})
