---
"@hono/otel": minor
---

Add the server span attributes that the OpenTelemetry HTTP semantic conventions require or recommend. Redact URL credentials and signed-URL query values in `url.full` and `url.query`; the new `sensitiveQueryParameters` option sets which query parameters are redacted.
