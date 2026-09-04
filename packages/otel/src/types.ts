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
  serviceName?: string
  serviceVersion?: string
}

export type NormalizedHttpInstrumentationConfig = Omit<
  HttpInstrumentationConfig,
  'captureRequestHeaders' | 'captureResponseHeaders'
> & {
  readonly requestHeaderSet: ReadonlySet<string>
  readonly responseHeaderSet: ReadonlySet<string>
  readonly captureRequestHeaders?: readonly string[]
  readonly captureResponseHeaders?: readonly string[]
}
