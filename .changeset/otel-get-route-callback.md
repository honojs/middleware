---
'@hono/otel': minor
---

feat(otel): add `getRoute` config callback so downstream adapters can resolve `http.route`

The middleware previously overwrote the `http.route` attribute on the active span with the matched Hono route pattern at finalize time, even when a downstream adapter (such as an RPC layer) had already set a more specific value on the span. The same pattern was also reported as the `http.route` attribute of the `http.server.request.duration` metric, so per-operation latency collapsed into the pattern bucket.

`getRoute(c)` is now an optional config callback. When it returns a non-empty string it is used for both the span attribute and the metric attribute; when it returns `undefined`, an empty string, or throws, the middleware falls back to the existing `routePath(c)` behavior. This is fully backward compatible and resolves [issue #1914](https://github.com/honojs/middleware/issues/1914).
