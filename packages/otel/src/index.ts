import type { Span, Tracer, Attributes, Exception } from '@opentelemetry/api'
import {
  context as otelContext,
  propagation,
  trace,
  SpanKind,
  SpanStatusCode,
} from '@opentelemetry/api'
import {
  ATTR_CLIENT_ADDRESS,
  ATTR_ERROR_TYPE,
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_SERVER_ADDRESS,
  ATTR_SERVER_PORT,
  ATTR_URL_FULL,
  ATTR_URL_PATH,
  ATTR_URL_QUERY,
  ATTR_URL_SCHEME,
  ATTR_USER_AGENT_ORIGINAL,
  ATTR_HTTP_ROUTE,
  ATTR_HTTP_RESPONSE_STATUS_CODE,
  ATTR_HTTP_REQUEST_HEADER,
  ATTR_HTTP_RESPONSE_HEADER,
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
  ERROR_TYPE_VALUE_OTHER,
} from '@opentelemetry/semantic-conventions'
import type { MiddlewareHandler, Context } from 'hono'
import { createMiddleware } from 'hono/factory'
import { routePath } from 'hono/route'
import {
  DEFAULT_SENSITIVE_QUERY_PARAMETERS,
  clientAddress,
  redactQuery,
  serverPort,
} from './attributes'
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
    sensitiveQueryParameters: new Set(
      config?.sensitiveQueryParameters ?? DEFAULT_SENSITIVE_QUERY_PARAMETERS
    ),
  }
  return norm
}

// Prefer the constructor name so subclasses such as `HTTPException` are told
// apart from a plain `Error`.
const errorTypeOf = (error: unknown): string =>
  error instanceof Error
    ? error.constructor?.name || error.name || ERROR_TYPE_VALUE_OTHER
    : ERROR_TYPE_VALUE_OTHER

// `recordException` reads `name`, `message` and `stack` from objects, and takes
// strings as the message. Other thrown values are stringified.
const toException = (error: unknown): Exception => {
  if (error instanceof Error || typeof error === 'string') {
    return error
  }
  if (typeof error === 'object' && error !== null) {
    return error as Exception
  }
  return String(error)
}

// The span status description, taken from the same value `recordException` gets.
const errorMessage = (error: unknown): string | undefined => {
  if (error === undefined) {
    return undefined
  }
  const exception = toException(error)
  if (typeof exception === 'string') {
    return exception
  }
  return typeof exception.message === 'string' ? exception.message : undefined
}

const resolveTracer = (config: NormalizedHttpInstrumentationConfig): Tracer | undefined => {
  if (config.tracer) {
    return config.tracer
  }
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
  // Let the user reduce the URL before the span starts, since `url.full`,
  // `url.path` and `url.query` are set at span creation and the raw URL may
  // carry query strings or identifiers that must not reach the tracing backend.
  const resolveUrl = (c: Context): string => {
    if (config.getUrlFull) {
      try {
        const resolved = config.getUrlFull(c)
        if (typeof resolved === 'string' && resolved.length > 0) {
          return resolved
        }
      } catch {
        // Ignore errors from the user-supplied resolver and fall back to the raw URL.
      }
    }
    return c.req.url
  }

  // The URL attributes, with the values of sensitive query parameters redacted.
  // A resolved URL that cannot be parsed is still reported as `url.full`, but
  // yields no `url.path` or `url.query`.
  const urlAttributes = (c: Context): Attributes => {
    const resolved = resolveUrl(c)
    let url: URL
    try {
      url = new URL(resolved)
    } catch {
      return { [ATTR_URL_FULL]: resolved }
    }
    // `url.full` must not carry credentials from the userinfo part of the URL.
    if (url.username || url.password) {
      url.username = 'REDACTED'
      url.password = 'REDACTED'
    }
    const query = redactQuery(url.search.slice(1), config.sensitiveQueryParameters)
    url.search = query
    const attributes: Attributes = {
      [ATTR_URL_FULL]: url.href,
      [ATTR_URL_PATH]: url.pathname,
    }
    if (query.length > 0) {
      attributes[ATTR_URL_QUERY] = query
    }
    return attributes
  }

  const activeReqs = config.captureActiveRequests ? createActiveRequestsTracker(config) : undefined
  const requestDuration = createRequestDurationTracker(config)

  return createMiddleware(async (c, next) => {
    const parent = propagation.extract(otelContext.active(), c.req.header())

    const method = c.req.method
    const requestUrl = new URL(c.req.url)
    // `URL.protocol` includes the trailing colon ("https:"); `url.scheme` doesn't.
    const scheme = requestUrl.protocol.slice(0, -1)

    const stableAttrs: Attributes = {
      [ATTR_HTTP_REQUEST_METHOD]: method,
      [ATTR_URL_SCHEME]: scheme,
      [ATTR_SERVICE_NAME]: config.serviceName,
      [ATTR_SERVICE_VERSION]: config.serviceVersion,
    }

    activeReqs?.increment(stableAttrs)
    const monotonicStartTime = performance.now()

    const requestHeaderAttributes: Attributes = {}
    const reqHeaders = c.req.header()
    for (const [rawName, value] of Object.entries(reqHeaders)) {
      const name = rawName.toLowerCase()
      if (config.requestHeaderSet.has(name)) {
        requestHeaderAttributes[ATTR_HTTP_REQUEST_HEADER(name)] = value
      }
    }

    const finalize = (span: Span | undefined, error: unknown, escaped: boolean) => {
      // When an error escaped the middleware, no response was built, so `c.res`
      // is still Hono's default and says nothing about what the client got.
      const status = escaped ? undefined : c.res.status
      // Server spans only fail on 5xx; a 4xx is the client's error, even when a
      // handler threw an `HTTPException` to produce it.
      const failed = status === undefined || status >= 500
      let errorType: string | undefined
      if (failed) {
        errorType =
          status === undefined || error !== undefined ? errorTypeOf(error) : String(status)
      }

      try {
        if (span) {
          if (status !== undefined) {
            const captureResp = config.responseHeaderSet
            for (const [name, value] of c.res.headers.entries()) {
              const lower = name.toLowerCase()
              if (captureResp.has(lower)) {
                span.setAttribute(ATTR_HTTP_RESPONSE_HEADER(lower), value)
              }
            }

            span.setAttribute(ATTR_HTTP_RESPONSE_STATUS_CODE, status)
          }
          if (errorType !== undefined) {
            span.setAttribute(ATTR_ERROR_TYPE, errorType)
          }

          if (failed) {
            // Record the exception only when it is what failed the request.
            if (status === undefined || error !== undefined) {
              try {
                span.recordException(toException(error))
              } catch {
                // Ignore errors when recording exception
              }
            }
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: errorMessage(error),
            })
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
          ...(status !== undefined && { [ATTR_HTTP_RESPONSE_STATUS_CODE]: status }),
          ...(errorType !== undefined && { [ATTR_ERROR_TYPE]: errorType }),
        })
      }
    }

    if (!tracer) {
      try {
        await next()
        finalize(undefined, c.error, false)
      } catch (e) {
        finalize(undefined, e, true)
        throw e
      }
      return
    }

    return tracer.startActiveSpan(
      spanName(c),
      {
        kind: SpanKind.SERVER,
        startTime: config.getTime?.(),
        // Everything known before the handler runs goes in at creation, since
        // samplers only see the attributes present then.
        attributes: {
          ...stableAttrs,
          ...urlAttributes(c),
          [ATTR_HTTP_ROUTE]: routePath(c),
          // Strip the brackets URL keeps around IPv6 hosts.
          [ATTR_SERVER_ADDRESS]: requestUrl.hostname.replace(/^\[|\]$/g, ''),
          [ATTR_SERVER_PORT]: serverPort(requestUrl, scheme),
          [ATTR_CLIENT_ADDRESS]: clientAddress(c.req.raw.headers),
          [ATTR_USER_AGENT_ORIGINAL]: c.req.header('user-agent'),
          ...requestHeaderAttributes,
        },
      },
      parent,
      async (span) => {
        try {
          await next()
          finalize(span, c.error, false)
        } catch (e) {
          finalize(span, e, true)
          throw e
        } finally {
          span.end(config.getTime?.())
        }
      }
    )
  })
}
