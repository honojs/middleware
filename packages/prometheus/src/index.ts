import type { Context } from 'hono'
import { createMiddleware } from 'hono/factory'
import type { DefaultMetricsCollectorConfiguration, RegistryContentType } from 'prom-client'
import { Registry, collectDefaultMetrics as promCollectDefaultMetrics } from 'prom-client'
import { type MetricOptions, type CustomMetricsOptions, createStandardMetrics } from './standardMetrics'

interface PrometheusOptions {
  registry?: Registry;
  metricsPath?: string;
  collectDefaultMetrics?: boolean | DefaultMetricsCollectorConfiguration<RegistryContentType>;
  prefix?: string;
  metricOptions?: Omit<CustomMetricsOptions, 'prefix' | 'register'>;
}

const evaluateCustomLabels = (
  customLabels: MetricOptions['customLabels'],
  context: Context,
) => {
  const labels: Record<string, string> = {}

  for (const [key, fn] of Object.entries(customLabels ?? {})) {
    labels[key] = fn(context)
  }

  return labels
}

export const prometheus = (options?: PrometheusOptions) => {
  const {
    registry = new Registry(),
    metricsPath = '/metrics',
    collectDefaultMetrics = false,
    prefix = '',
    metricOptions,
  } = options ?? {}

  if (collectDefaultMetrics) {
    promCollectDefaultMetrics({
      prefix,
      register: registry,
      ...(typeof collectDefaultMetrics === 'object' && collectDefaultMetrics)
    })
  }

  const metrics = createStandardMetrics({
    prefix,
    registry,
    customOptions: metricOptions,
  })
  

  const metricsEndpointMiddleware = createMiddleware(async (c, next) => {
    c.body(await registry.metrics())

    await next()
  })

  return createMiddleware(async (c, next) => {
    const timer = metrics.requestDuration?.startTimer()

    if (c.req.path === metricsPath) {
      await metricsEndpointMiddleware(c, next)
    }
  
    try {
      await next()
    } finally {
      const commonLabels = {
        method: c.req.method,
        route: c.req.routePath,
        status: c.res.status.toString(),
        ok: String(c.res.ok),
      }

      timer?.({
        ...commonLabels,
        ...evaluateCustomLabels(metricOptions?.requestDuration?.customLabels, c)
      })
  
      metrics.requestsTotal?.inc({
        ...commonLabels,
        ...evaluateCustomLabels(metricOptions?.requestsTotal?.customLabels, c)
      })
    }
  })
}
