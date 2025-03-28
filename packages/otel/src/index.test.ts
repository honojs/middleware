import { SpanKind, SpanStatusCode } from '@opentelemetry/api'
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import {
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_HTTP_RESPONSE_HEADER,
  ATTR_HTTP_RESPONSE_STATUS_CODE,
  ATTR_URL_FULL,
  ATTR_HTTP_ROUTE,
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
  app.post('/error', (_) => {
    throw new Error('error message')
  })

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
    for (const [name, value] of response.headers.entries()) {
      expect(span.attributes[ATTR_HTTP_RESPONSE_HEADER(name)]).toBe(value)
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
})
