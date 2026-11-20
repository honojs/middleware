---
"@hono/otel": minor
---

Stop marking server spans as errors and recording exceptions for 4xx responses, including those from an `HTTPException`; only 5xx responses and errors that escape the middleware fail a request. Failed requests now set `error.type` on the span and the `http.server.request.duration` metric.
