import type { Meter, Counter, Histogram } from '@opentelemetry/api'
import { ValueType } from '@opentelemetry/api'
import type { Context } from 'hono'

const ATTR_HTTP_METHOD = 'http.request.method'
const ATTR_HTTP_STATUS_CODE = 'http.response.status_code'
const ATTR_HTTP_ROUTE = 'http.route'
const ATTR_HTTP_OK = 'http.response.ok'

const honoRequestDuration = {
  name: 'hono_server_duration',
  description: 'Duration of HTTP requests in seconds',
}

const honoRequestsTotal = {
  name: 'hono_server_requests',
  description: 'Total number of HTTP requests',
}

export type OtelMetrics = {
  requestDuration: Histogram
  requestsTotal: Counter
}

export const createOtelMetrics = (meter: Meter): OtelMetrics => {
  const requestDuration = meter.createHistogram(honoRequestDuration.name, {
    description: honoRequestDuration.description,
    unit: 's',
    valueType: ValueType.DOUBLE,
  })

  const requestsTotal = meter.createCounter(honoRequestsTotal.name, {
    description: honoRequestsTotal.description,
    valueType: ValueType.INT,
  })

  return { requestDuration, requestsTotal }
}

export const observeOtelMetrics = (
  { requestDuration, requestsTotal }: OtelMetrics,
  context: Context,
  { startTime }: { startTime: number }
): void => {
  const duration = (performance.now() - startTime) / 1000

  const attributes = {
    [ATTR_HTTP_METHOD]: context.req.method,
    [ATTR_HTTP_STATUS_CODE]: context.res.status,
    [ATTR_HTTP_ROUTE]: context.req.routePath,
    [ATTR_HTTP_OK]: context.res.ok,
  }

  requestDuration.record(duration, attributes)
  requestsTotal.add(1, attributes)
}
