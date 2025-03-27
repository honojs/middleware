import type { TracerProvider } from '@opentelemetry/api'
import { SpanKind, SpanStatusCode,  trace } from '@opentelemetry/api'
import {
  ATTR_HTTP_REQUEST_HEADER,
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_HTTP_RESPONSE_HEADER,
  ATTR_HTTP_RESPONSE_STATUS_CODE,
  ATTR_URL_FULL,
  ATTR_HTTP_ROUTE,
} from '@opentelemetry/semantic-conventions'
import type { Env, Input } from 'hono'
import { createMiddleware } from 'hono/factory'
import metadata from '../package.json' with { type: 'json'}

const PACKAGE_NAME = metadata.name
const PACKAGE_VERSION = metadata.version

export type OtelOptions = {
  augmentSpan?: false;
  tracerProvider?: TracerProvider
} | {
  augmentSpan: true;
}

export const otel = <E extends Env = any, P extends string = any, I extends Input = {}>(
  options: OtelOptions = {}
) => {
  if (options.augmentSpan) {
    return createMiddleware<E, P, I>(async (c, next) => {
      const result = await next()
      const span = trace.getActiveSpan()
      if (span != null) {
        const route = c.req.matchedRoutes[c.req.matchedRoutes.length - 1]
        span.setAttribute(ATTR_HTTP_ROUTE, route.path)
        span.updateName(`${c.req.method} ${route.path}`)
      }
      return result
    })
  }
  const tracerProvider = options.tracerProvider ?? trace.getTracerProvider()
  const tracer = tracerProvider.getTracer(PACKAGE_NAME, PACKAGE_VERSION)
  return createMiddleware<E, P, I>(async (c, next) => {
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
