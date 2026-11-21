---
"@hono/otel": minor
---

Don't mark server spans as errors for 4xx responses. Now only 5xx responses and errors that escape the middleware mark a server span as an error. Also, failed requests now set `error.type` on the span and the `http.server.request.duration` metric.
