import type { Span} from '@opentelemetry/api';
import { SpanStatusCode } from '@opentelemetry/api'
import { ATTR_ERROR_TYPE } from '@opentelemetry/semantic-conventions'

/**
 * Sets the span with the error passed in params
 * @param {Span} span the span that need to be set
 * @param {Error} error error that will be set to span
 */
export const setSpanWithError = (span: Span, error: Error): void => {
  span.setAttribute(ATTR_ERROR_TYPE, error.name)
  span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) })
  span.recordException(error)
}
