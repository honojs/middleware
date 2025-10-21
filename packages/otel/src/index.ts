import type { TracerProvider, MeterProvider, TimeInput } from '@opentelemetry/api'
import { SpanKind, SpanStatusCode, trace, context, propagation, metrics } from '@opentelemetry/api'
import {
  ATTR_HTTP_REQUEST_HEADER,
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_HTTP_RESPONSE_HEADER,
  ATTR_HTTP_RESPONSE_STATUS_CODE,
  ATTR_URL_FULL,
  ATTR_HTTP_ROUTE,
  ATTR_URL_PATH,
  ATTR_URL_SCHEME,
} from '@opentelemetry/semantic-conventions'
import type { MiddlewareHandler } from 'hono'
import { createMiddleware } from 'hono/factory'
import type { RequestHeader, ResponseHeader } from 'hono/utils/headers'
import metadata from '../package.json' with { type: 'json' }
import { createOtelMetrics, observeOtelMetrics } from './metrics'
import { setSpanWithError } from './utils'

const PACKAGE_NAME = metadata.name
const PACKAGE_VERSION = metadata.version

export type OtelOptions =
  | {
      augmentSpan?: false
      tracerProvider?: TracerProvider
      meterProvider?: MeterProvider
      captureRequestHeaders?: (keyof Record<RequestHeader | (string & {}), string>)[]
      captureResponseHeaders?: (keyof Record<ResponseHeader | (string & {}), string>)[]
      getTime?(): TimeInput
    }
  | {
      augmentSpan: true
    }

export const otel = (options: OtelOptions = {}): MiddlewareHandler => {
  if (options.augmentSpan) {
    return createMiddleware(async (c, next) => {
      // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
      const result = await next()
      const span = trace.getActiveSpan()
      if (span != null) {
        const routePath = c.req.routePath
        span.setAttribute(ATTR_HTTP_ROUTE, routePath)
        span.updateName(`${c.req.method} ${routePath}`)
      }
      return result
    })
  }
  const tracerProvider = options.tracerProvider ?? trace.getTracerProvider()
  const tracer = tracerProvider.getTracer(PACKAGE_NAME, PACKAGE_VERSION)
  const meterProvider = options.meterProvider ?? metrics.getMeterProvider()
  const meter = meterProvider.getMeter(PACKAGE_NAME, PACKAGE_VERSION)
  const otelMetrics = createOtelMetrics(meter)
  const captureRequestHeaders = options.captureRequestHeaders
    ? new Set(
        [...options.captureRequestHeaders, 'traceparent', 'tracestate'].map((h) =>
          h.toLowerCase()
        )
      )
    : undefined
  const captureResponseHeaders = options.captureResponseHeaders
    ? new Set(options.captureResponseHeaders.map((h) => h.toLowerCase()))
    : undefined

  return createMiddleware(async (c, next) => {
    // Handle propagation of trace context from a request using the W3C Trace Context format
    let activeContext = context.active()
    if (c.req.header('traceparent')) {
      activeContext = propagation.extract(context.active(), c.req.header())
    }

    const routePath = c.req.routePath
    const startTime = performance.now()

    const url = new URL(c.req.url)

    await tracer.startActiveSpan(
      `${c.req.method} ${c.req.routePath}`,
      {
        kind: SpanKind.SERVER,
        attributes: {
          [ATTR_HTTP_REQUEST_METHOD]: c.req.method,
          [ATTR_URL_FULL]: url.href,
          [ATTR_URL_PATH]: url.pathname,
          [ATTR_URL_SCHEME]: url.protocol.slice(0, -1),
          [ATTR_HTTP_ROUTE]: routePath,
        },
        startTime: options.getTime?.(),
      },
      activeContext,
      async (span) => {
        for (const [name, value] of Object.entries(c.req.header())) {
          if (captureRequestHeaders?.has(name)) {
            span.setAttribute(ATTR_HTTP_REQUEST_HEADER(name), value)
          }
        }
        try {
          await next()
          // Update the span name and route path now that we have the response
          // because the route path may have changed
          span.updateName(`${c.req.method} ${c.req.routePath}`)
          span.setAttribute(ATTR_HTTP_ROUTE, c.req.routePath)
          span.setAttribute(ATTR_HTTP_RESPONSE_STATUS_CODE, c.res.status)
          for (const [name, value] of c.res.headers.entries()) {
            if (captureResponseHeaders?.has(name)) {
              span.setAttribute(ATTR_HTTP_RESPONSE_HEADER(name), value)
            }
          }
          if (c.error) {
            setSpanWithError(span, c.error)
          }
        } catch (e) {
          if (e instanceof Error) {
            setSpanWithError(span, e)
          }
          throw e
        } finally {
          span.end(options.getTime?.())
          observeOtelMetrics(otelMetrics, c, { startTime })
        }
      }
    )
  })
}
