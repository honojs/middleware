---
'@hono/otel': minor
---

feat(otel): add `getUrlFull` config callback to redact the `url.full` span attribute

The middleware records the complete request URL as `url.full`, including the query string. The OpenTelemetry semantic conventions note that `url.full` may carry credentials, and query strings or path segments can also carry one-time tokens such as password-reset or invitation links. `getUrlFull(c)` is an optional config callback: when it returns a non-empty string, that value is recorded instead. Returning `undefined`, an empty string, or throwing falls back to the raw request URL, so existing behavior is unchanged when the hook is not provided.
