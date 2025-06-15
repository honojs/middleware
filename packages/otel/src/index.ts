import type { TracerProvider } from '@opentelemetry/api'
import { SpanKind, SpanStatusCode, trace, context, propagation } from '@opentelemetry/api'
import {
  ATTR_HTTP_REQUEST_HEADER,
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_HTTP_RESPONSE_HEADER,
  ATTR_HTTP_RESPONSE_STATUS_CODE,
  ATTR_URL_FULL,
  ATTR_HTTP_ROUTE,
} from '@opentelemetry/semantic-conventions'
import type { MiddlewareHandler } from 'hono'
import { createMiddleware } from 'hono/factory'
import metadata from '../package.json' with { type: 'json' }

const PACKAGE_NAME = metadata.name
const PACKAGE_VERSION = metadata.version

export type OtelOptions =
  | {
      augmentSpan?: false
      tracerProvider?: TracerProvider
    }
  | {
      augmentSpan: true
    }

export const otel = (options: OtelOptions = {}): MiddlewareHandler => {
  if (options.augmentSpan) {
    return createMiddleware(async (c, next) => {
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
  return createMiddleware(async (c, next) => {
    // Handle propagation of trace context from a request using the W3C Trace Context format
    let activeContext = context.active()
    if (c.req.header('traceparent')) {
      activeContext = propagation.extract(context.active(), c.req.header())
    }

    const routePath = c.req.routePath
    await tracer.startActiveSpan(
      `${c.req.method} ${c.req.routePath}`,
      {
        kind: SpanKind.SERVER,
        attributes: {
          [ATTR_HTTP_REQUEST_METHOD]: c.req.method,
          [ATTR_URL_FULL]: c.req.url,
          [ATTR_HTTP_ROUTE]: routePath,
        },
      },
      activeContext,
      async (span) => {
        for (const [name, value] of Object.entries(c.req.header())) {
          span.setAttribute(ATTR_HTTP_REQUEST_HEADER(name), value)
        }
        try {
          await next()
          // Update the span name and route path now that we have the response
          // because the route path may have changed
          span.updateName(`${c.req.method} ${c.req.routePath}`)
          span.setAttribute(ATTR_HTTP_ROUTE, c.req.routePath)
          span.setAttribute(ATTR_HTTP_RESPONSE_STATUS_CODE, c.res.status)
          for (const [name, value] of c.res.headers.entries()) {
            span.setAttribute(ATTR_HTTP_RESPONSE_HEADER(name), value)
          }
          if (c.error) {
            span.recordException(c.error)
            span.setStatus({ code: SpanStatusCode.ERROR, message: String(c.error) })
          }
        } catch (e) {
          if (e instanceof Error) {
            span.recordException(e)
          }
          span.setStatus({ code: SpanStatusCode.ERROR, message: String(e) })
          throw e
        } finally {
          span.end()
        }
      }
    )
  })
}
