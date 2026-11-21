import type { MeterProvider, TimeInput, Tracer, TracerProvider } from '@opentelemetry/api'
import type { Context as HonoContext } from 'hono'

export type HttpInstrumentationConfig = {
  tracerProvider?: TracerProvider
  meterProvider?: MeterProvider
  tracer?: Tracer
  captureRequestHeaders?: string[]
  captureResponseHeaders?: string[]
  captureActiveRequests?: boolean
  getTime?(): TimeInput
  disableTracing?: boolean
  spanNameFactory?: (c: HonoContext) => string
  /**
   * Resolves the value of the `http.route` attribute used at finalize time
   * for both the active span and the `http.server.request.duration` metric.
   *
   * Returning a non-empty string overrides the default, which is the Hono
   * route pattern (for example `/rpc/*`). This is useful when a downstream
   * adapter resolves a more specific route name during request handling
   * (such as an RPC operation name) and you want both the span and the
   * metric to carry that resolved value instead of the pattern.
   *
   * Returning `undefined` or throwing falls back to the default pattern, so
   * the existing behavior is preserved when this hook is not provided.
   */
  getRoute?: (c: HonoContext) => string | undefined
  /**
   * Returns the URL to report instead of the request URL, so you can remove
   * tokens or identifiers that must not reach your tracing backend.
   *
   * `url.full`, `url.path` and `url.query` all come from the returned URL.
   * Credentials and the query parameters in `sensitiveQueryParameters` are
   * still redacted afterwards. Return an absolute URL: anything else is
   * reported as `url.full` only, with no `url.path` or `url.query`.
   *
   * Runs when the span starts, before routing, so values a handler sets on the
   * context later are not available.
   *
   * Return `undefined` or an empty string, or throw, to use the request URL.
   */
  getUrlFull?: (c: HonoContext) => string | undefined
  /**
   * Query parameters whose values are replaced with `REDACTED` in the
   * `url.full` and `url.query` span attributes. Keys match case-sensitively.
   *
   * This list replaces the default (`X-Amz-Signature`, `X-Amz-Credential`,
   * `X-Amz-Security-Token`, `AWSAccessKeyId`, `Signature`, `sig`,
   * `X-Goog-Signature`)
   * Pass an empty array to turn redaction off.
   */
  sensitiveQueryParameters?: string[]
  serviceName?: string
  serviceVersion?: string
}

export type NormalizedHttpInstrumentationConfig = Omit<
  HttpInstrumentationConfig,
  'captureRequestHeaders' | 'captureResponseHeaders' | 'sensitiveQueryParameters'
> & {
  readonly sensitiveQueryParameters: ReadonlySet<string>
  readonly requestHeaderSet: ReadonlySet<string>
  readonly responseHeaderSet: ReadonlySet<string>
  readonly captureRequestHeaders?: readonly string[]
  readonly captureResponseHeaders?: readonly string[]
}
