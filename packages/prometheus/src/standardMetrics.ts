import type { Context } from 'hono'
import type { CounterConfiguration, HistogramConfiguration, Metric } from 'prom-client'
import { Counter, Histogram, type Registry } from 'prom-client'

export type MetricOptions = {
  disabled?: boolean
  customLabels?: Record<string, (c: Context) => string>
} & (
  | ({ type: 'counter' } & CounterConfiguration<string>)
  | ({ type: 'histogram' } & HistogramConfiguration<string>)
)

const standardMetrics = {
  requestDuration: {
    type: 'histogram',
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'status', 'ok', 'route'],
    // OpenTelemetry recommendation for histogram buckets of http request duration:
    // https://opentelemetry.io/docs/specs/semconv/http/http-metrics/#metric-httpserverrequestduration
    buckets: [0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 7.5, 10],
  },
  requestsTotal: {
    type: 'counter',
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'status', 'ok', 'route'],
  },
} satisfies Record<string, MetricOptions>

export type MetricName = keyof typeof standardMetrics

export type CustomMetricsOptions = {
  [Name in MetricName]?: Partial<Omit<MetricOptions, 'type' | 'collect' | 'labelNames'>>
}

type CreatedMetrics = {
  [Name in MetricName]: (typeof standardMetrics)[Name]['type'] extends 'counter'
    ? Counter<string>
    : Histogram<string>
}

const getMetricConstructor = (type: MetricOptions['type']) =>
  ({
    counter: Counter,
    histogram: Histogram,
  }[type])

export const createStandardMetrics = ({
  registry,
  prefix = '',
  customOptions,
}: {
  registry: Registry
  prefix?: string
  customOptions?: CustomMetricsOptions
}) => {
  const createdMetrics: Record<string, Metric> = {}

  for (const [metric, options] of Object.entries(standardMetrics)) {
    const opts: MetricOptions = {
      ...options,
      ...customOptions?.[metric as MetricName],
    }

    if (opts.disabled) {
      continue
    }

    const MetricConstructor = getMetricConstructor(opts.type)

    createdMetrics[metric] = new MetricConstructor({
      ...(opts as object),
      name: `${prefix}${opts.name}`,
      help: opts.help,
      registers: [...(opts.registers ?? []), registry],
      labelNames: [...(opts.labelNames ?? []), ...Object.keys(opts.customLabels ?? {})],
      ...(opts.type === 'histogram' &&
        opts.buckets && {
          buckets: opts.buckets,
        }),
    })
  }

  return createdMetrics as CreatedMetrics
}
