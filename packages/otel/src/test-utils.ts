import type { Meter, MeterProvider as MeterProviderApi } from '@opentelemetry/api'
import {
  InMemoryMetricExporter,
  PeriodicExportingMetricReader,
  AggregationTemporality,
  MeterProvider,
} from '@opentelemetry/sdk-metrics'
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'

export const createMockMeterProvider = (overrides: Partial<Meter> = {}): MeterProviderApi => {
  const meter: Meter = {
    createCounter:
      overrides.createCounter ??
      (() => ({
        add() {
          return
        },
      })),
    createUpDownCounter:
      overrides.createUpDownCounter ??
      (() => ({
        add() {
          return
        },
      })),
    createHistogram:
      overrides.createHistogram ??
      (() => ({
        record() {
          return
        },
      })),
    createObservableGauge:
      overrides.createObservableGauge ??
      (() => ({
        observation() {
          return
        },
      })),
    createObservableCounter:
      overrides.createObservableCounter ??
      (() => ({
        observation() {
          return
        },
      })),
    createObservableUpDownCounter:
      overrides.createObservableUpDownCounter ??
      (() => ({
        observation() {
          return
        },
      })),
    addBatchObservableCallback: overrides.addBatchObservableCallback ?? (() => {}),
    removeBatchObservableCallback: overrides.removeBatchObservableCallback ?? (() => {}),
  } as Meter
  return { getMeter: () => meter }
}

export const createTestTracer = (): {
  exporter: InMemorySpanExporter
  processor: SimpleSpanProcessor
  tracerProvider: NodeTracerProvider
} => {
  const exporter = new InMemorySpanExporter()
  const processor = new SimpleSpanProcessor(exporter)
  const tracerProvider = new NodeTracerProvider({ spanProcessors: [processor] })
  return { exporter, processor, tracerProvider }
}

export const createTestMeter = (): {
  exporter: InMemoryMetricExporter
  reader: PeriodicExportingMetricReader
  meterProvider: MeterProvider
} => {
  const exporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE)
  const reader = new PeriodicExportingMetricReader({
    exporter,
    exportIntervalMillis: 50,
  })
  const meterProvider = new MeterProvider({ readers: [reader] })

  return { meterProvider, exporter, reader }
}
