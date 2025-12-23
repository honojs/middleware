---
'@hono/otel': minor
---

fix: updates type value of activeRequests and allows disabling it
This change is made due to Deno not allowing `INT` value types and the current setup can therefore break Deno applications without any proper workaround.
There are no code changes required for existing (functional) applications, but if opentelemetry values are used for more than autodetection you might have to make minor changes to calculations or similar.
