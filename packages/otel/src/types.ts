import type { MeterProvider, TimeInput, Tracer, TracerProvider } from '@opentelemetry/api'
import type { Context as HonoContext } from 'hono'

export type HttpInstrumentationConfig = {
  tracerProvider?: TracerProvider
  meterProvider?: MeterProvider
  tracer?: Tracer
  captureRequestHeaders?: string[]
  captureResponseHeaders?: string[]
  getTime?(): TimeInput
  disableTracing?: boolean
  spanNameFactory?: (c: HonoContext) => string
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
