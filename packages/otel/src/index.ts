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
    captureActiveRequests: config?.captureActiveRequests ?? true,
    captureRequestHeaders: reqHeadersSrc,
    captureResponseHeaders: resHeadersSrc,
  }
  return norm
}

const resolveTracer = (config: NormalizedHttpInstrumentationConfig): Tracer | undefined => {
  if (config.tracer) {
    return config.tracer
  }
  const provider = config.tracerProvider ?? trace.getTracerProvider()
  return provider.getTracer(INSTRUMENTATION_SCOPE.name, INSTRUMENTATION_SCOPE.version)
}

/**
 * Swap in a pass-through body that calls `onEnd` once: when the body has been
 * fully sent, errors, or the client goes away. That is when the request ends
 * for a streamed body (`stream`, `streamSSE`) and, a moment after the handler
 * returns, for a buffered one; the headers cannot tell the two apart, since
 * `stream()` sets none.
 *
 * Returns false, changing nothing, when there is no body to wait for: a null
 * body, an error, or HEAD, whose body Hono discards unread.
 */
const onBodyEnd = (c: Context, onEnd: (cause?: unknown) => void): boolean => {
  const res = c.res
  if (c.error || !res.body || c.req.method === 'HEAD') {
    return false
  }
  let ended = false
  const end = (cause?: unknown) => {
    if (ended) {
      return
    }
    ended = true
    onEnd(cause)
  }
  const reader = res.body.getReader()
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read()
        if (done) {
          controller.close()
          end()
        } else {
          controller.enqueue(value)
        }
      } catch (e) {
        controller.error(e)
        end(e)
      }
    },
    cancel(reason) {
      end()
      return reader.cancel(reason)
    },
  })
  c.res = new Response(body, res)
  return true
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

  const activeReqs = config.captureActiveRequests ? createActiveRequestsTracker(config) : undefined
  const requestDuration = createRequestDurationTracker(config)

  return createMiddleware(async (c, next) => {
    const parent = propagation.extract(otelContext.active(), c.req.header())

    const method = c.req.method

    const stableAttrs: Attributes = {
      [ATTR_HTTP_REQUEST_METHOD]: method,
      [ATTR_SERVICE_NAME]: config.serviceName,
      [ATTR_SERVICE_VERSION]: config.serviceVersion,
    }

    activeReqs?.increment(stableAttrs)
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
        activeReqs?.decrement(stableAttrs)
        // Update route and name since they may have changed after routing finished.
        // Prefer a value resolved by the user via `getRoute` (e.g. an RPC operation
        // name that a downstream adapter has set on the context) over the matched
        // Hono pattern, so adapters can surface the real operation in both the
        // span attribute and the request duration metric.
        let finalRoute = routePath(c)
        if (config.getRoute) {
          try {
            const resolved = config.getRoute(c)
            if (typeof resolved === 'string' && resolved.length > 0) {
              finalRoute = resolved
            }
          } catch {
            // Ignore errors from the user-supplied route resolver and fall back to
            // the default pattern so the request still produces a clean span.
          }
        }
        span?.setAttribute(ATTR_HTTP_ROUTE, finalRoute)

        span?.updateName(spanName(c))
        // Convert duration to seconds as the time unit from performance.now() is in milliseconds
        const duration = (performance.now() - monotonicStartTime) / 1000

        requestDuration.record(duration, {
          ...stableAttrs,
          [ATTR_HTTP_ROUTE]: finalRoute,
          [ATTR_HTTP_RESPONSE_STATUS_CODE]: c.res.status,
        })
      }
    }

    if (!tracer) {
      try {
        await next()
        if (
          onBodyEnd(c, (cause) => {
            finalize(undefined, cause)
          })
        ) {
          return
        }
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
          ...stableAttrs,
          [ATTR_URL_FULL]: c.req.url,
          [ATTR_HTTP_ROUTE]: routePath(c),
        },
      },
      parent,
      async (span) => {
        let deferred = false
        try {
          for (const [k, v] of Object.entries(deferredRequestHeaderAttributes)) {
            span.setAttribute(k, v)
          }
          await next()
          // The response isn't sent when the handler returns (a streamed body
          // may run for minutes): end the span when the body has been sent.
          deferred = onBodyEnd(c, (cause) => {
            finalize(span, cause)
            span.end(config.getTime?.())
          })
          if (deferred) {
            return
          }
          finalize(span, c.error)
        } catch (e) {
          finalize(span, e)
          throw e
        } finally {
          if (!deferred) {
            span.end(config.getTime?.())
          }
        }
      }
    )
  })
}
