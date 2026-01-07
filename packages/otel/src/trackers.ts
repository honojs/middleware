import { metrics, ValueType } from '@opentelemetry/api'
import type { Attributes } from '@opentelemetry/api'
import {
  METRIC_HTTP_SERVER_ACTIVE_REQUESTS,
  METRIC_HTTP_SERVER_REQUEST_DURATION,
} from '@opentelemetry/semantic-conventions/incubating'
import { INSTRUMENTATION_SCOPE } from './consts'
import type { NormalizedHttpInstrumentationConfig } from './types'

// Helper to select the appropriate meter (prefer explicit provider if supplied)
const getMeter = (config: NormalizedHttpInstrumentationConfig) =>
  (config.meterProvider ?? metrics.getMeterProvider()).getMeter(INSTRUMENTATION_SCOPE.name)

export const createRequestDurationTracker = (
  config: NormalizedHttpInstrumentationConfig
): { record: (duration: number, attrs: Attributes) => void } => {
  const histogram = getMeter(config).createHistogram(METRIC_HTTP_SERVER_REQUEST_DURATION, {
    description: 'Duration of HTTP requests in seconds',
    unit: 's',
    valueType: ValueType.DOUBLE,
  })
  return {
    record(duration: number, attrs: Attributes) {
      histogram.record(duration, attrs)
    },
  }
}

export const createActiveRequestsTracker = (
  config: NormalizedHttpInstrumentationConfig
): {
  increment: (attrs: Attributes) => void
  decrement: (attrs: Attributes) => void
} => {
  const counter = getMeter(config).createUpDownCounter(METRIC_HTTP_SERVER_ACTIVE_REQUESTS, {
    description: 'Number of active (in-flight) HTTP server requests',
    valueType: ValueType.DOUBLE,
  })
  return {
    increment(attrs: Attributes) {
      counter.add(1.0, attrs)
    },
    decrement(attrs: Attributes) {
      counter.add(-1.0, attrs)
    },
  }
}
