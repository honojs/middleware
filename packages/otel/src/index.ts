import type { Span, Tracer, Attributes } from '@opentelemetry/api'
import {
  context as otelContext,
  propagation,
  trace,
  SpanKind,
  SpanStatusCode,
} from '@opentelemetry/api'
import {
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_URL_FULL,
  ATTR_HTTP_ROUTE,
  ATTR_HTTP_RESPONSE_STATUS_CODE,
  ATTR_HTTP_REQUEST_HEADER,
  ATTR_HTTP_RESPONSE_HEADER,
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions'
import type { MiddlewareHandler, Context } from 'hono'
import { createMiddleware } from 'hono/factory'
import { routePath } from 'hono/route'
import { INSTRUMENTATION_SCOPE } from './consts'
import { createActiveRequestsTracker, createRequestDurationTracker } from './trackers'
import type { HttpInstrumentationConfig, NormalizedHttpInstrumentationConfig } from './types'

const normalizeConfig = (
  config?: HttpInstrumentationConfig
): NormalizedHttpInstrumentationConfig => {
  const reqHeadersSrc = [...(config?.captureRequestHeaders ?? [])]
  const resHeadersSrc = [...(config?.captureResponseHeaders ?? [])]
  const requestHeaderSet = new Set(reqHeadersSrc.map((h) => h.toLowerCase()))
  const responseHeaderSet = new Set(resHeadersSrc.map((h) => h.toLowerCase()))
  const norm: NormalizedHttpInstrumentationConfig = {
    ...config,
    requestHeaderSet,
    responseHeaderSet,
    captureRequestHeaders: reqHeadersSrc,
    captureResponseHeaders: resHeadersSrc,
  }
  return norm
}

const resolveTracer = (config: NormalizedHttpInstrumentationConfig): Tracer | undefined => {
  if (config.tracer) return config.tracer
  const provider = config.tracerProvider ?? trace.getTracerProvider()
  return provider.getTracer(INSTRUMENTATION_SCOPE.name, INSTRUMENTATION_SCOPE.version)
}

export const httpInstrumentationMiddleware = (
  userConfig: HttpInstrumentationConfig = {
    captureRequestHeaders: [],
    captureResponseHeaders: [],
    disableTracing: false,
  }
): MiddlewareHandler => {
  const config = normalizeConfig(userConfig)
  const tracer = config.disableTracing ? undefined : resolveTracer(config)

  const spanName = (c: Context) => config.spanNameFactory?.(c) ?? `${c.req.method} ${routePath(c)}`

  const activeReqs = createActiveRequestsTracker(config)
  const requestDuration = createRequestDurationTracker(config)

  return createMiddleware(async (c, next) => {
    const parent = propagation.extract(otelContext.active(), c.req.header())

    const method = c.req.method

    const stableAttrs: Attributes = {
      [ATTR_HTTP_REQUEST_METHOD]: method,
      [ATTR_SERVICE_NAME]: config.serviceName,
      [ATTR_SERVICE_VERSION]: config.serviceVersion,
    }

    activeReqs.increment(stableAttrs)
    const monotonicStartTime = performance.now()

    const deferredRequestHeaderAttributes: Record<string, string> = {}
    const reqHeaders = c.req.header()
    for (const [rawName, value] of Object.entries(reqHeaders)) {
      const name = rawName.toLowerCase()
      if (config.requestHeaderSet.has(name)) {
        deferredRequestHeaderAttributes[ATTR_HTTP_REQUEST_HEADER(name)] = value
      }
    }

    const finalize = (span: Span | undefined, error: unknown) => {
      try {
        const status = c.res.status

        if (span) {
          const captureResp = config.responseHeaderSet
          for (const [name, value] of c.res.headers.entries()) {
            const lower = name.toLowerCase()
            if (captureResp.has(lower)) {
              span.setAttribute(ATTR_HTTP_RESPONSE_HEADER(lower), value)
            }
          }

          span.setAttribute(ATTR_HTTP_RESPONSE_STATUS_CODE, status)
          if (status >= 500) {
            span.setStatus({ code: SpanStatusCode.ERROR })
          }

          if (error) {
            try {
              span.recordException(error as Error)
            } catch {
              // Ignore errors when recording exception
            }
            span.setStatus({ code: SpanStatusCode.ERROR })
          }
        }
      } finally {
        activeReqs.decrement(stableAttrs)
        // Update route and name since they may have changed after routing finished
        span?.setAttribute(ATTR_HTTP_ROUTE, routePath(c))

        span?.updateName(spanName(c))
        requestDuration.record(performance.now() - monotonicStartTime, {
          ...stableAttrs,
          [ATTR_HTTP_ROUTE]: routePath(c),
          [ATTR_HTTP_RESPONSE_STATUS_CODE]: c.res.status,
        })
      }
    }

    if (!tracer) {
      try {
        await next()
        finalize(undefined, undefined)
      } catch (e) {
        finalize(undefined, e)
        throw e
      }
      return
    }

    return tracer.startActiveSpan(
      spanName(c),
      {
        kind: SpanKind.SERVER,
        startTime: config.getTime?.(),
        attributes: {
          [ATTR_HTTP_REQUEST_METHOD]: method,
          [ATTR_URL_FULL]: c.req.url,
          [ATTR_HTTP_ROUTE]: routePath(c),
        },
      },
      parent,
      async (span) => {
        try {
          for (const [k, v] of Object.entries(deferredRequestHeaderAttributes)) {
            span.setAttribute(k, v)
          }
          await next()
          finalize(span, c.error)
        } catch (e) {
          finalize(span, e)
          throw e
        } finally {
          span.end(config.getTime?.())
        }
      }
    )
  })
}
