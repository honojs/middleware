import { SpanKind, SpanStatusCode } from '@opentelemetry/api'
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
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
      expect.stringMatching(/Error: error message\n.*at \S+\/src\/index.test.ts:\d+:\d+\n/)
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
})
