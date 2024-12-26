import { SpanKind, SpanStatusCode, type TracerProvider, trace } from '@opentelemetry/api'
import {
  ATTR_HTTP_REQUEST_HEADER,
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_HTTP_RESPONSE_HEADER,
  ATTR_HTTP_RESPONSE_STATUS_CODE,
  ATTR_URL_FULL,
  ATTR_HTTP_ROUTE,
} from '@opentelemetry/semantic-conventions'
import { createMiddleware } from 'hono/factory'
import type { Env, Input } from 'hono'

const PACKAGE_NAME = '@hono/otel'
const PACKAGE_VERSION = '0.1.0'

export interface OtelOptions {
  tracerProvider?: TracerProvider
}

export const otel = <E extends Env = any, P extends string = any, I extends Input = {}>(
  options: OtelOptions = {}
) => {
  const tracerProvider = options.tracerProvider ?? trace.getTracerProvider()
  return createMiddleware<E, P, I>(async (c, next) => {
    const tracer = tracerProvider.getTracer(PACKAGE_NAME, PACKAGE_VERSION)
    const route = c.req.matchedRoutes[c.req.matchedRoutes.length - 1]
    await tracer.startActiveSpan(
      `${c.req.method} ${route.path}`,
      {
        kind: SpanKind.SERVER,
        attributes: {
          [ATTR_HTTP_REQUEST_METHOD]: c.req.method,
          [ATTR_URL_FULL]: c.req.url,
          [ATTR_HTTP_ROUTE]: route.path,
        },
      },
      async (span) => {
        for (const [name, value] of Object.entries(c.req.header())) {
          span.setAttribute(ATTR_HTTP_REQUEST_HEADER(name), value)
        }
        try {
          await next()
          span.setAttribute(ATTR_HTTP_RESPONSE_STATUS_CODE, c.res.status)
          for (const [name, value] of c.res.headers.entries()) {
            span.setAttribute(ATTR_HTTP_RESPONSE_HEADER(name), value)
          }
          if (c.error) {
            span.setStatus({ code: SpanStatusCode.ERROR, message: String(c.error) })
          }
        } catch (e) {
          span.setStatus({ code: SpanStatusCode.ERROR, message: String(e) })
          throw e
        } finally {
          span.end()
        }
      }
    )
  })
}
