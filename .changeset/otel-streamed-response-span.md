---
'@hono/otel': patch
---

fix(otel): end the request span and metrics when the response body has been sent

The span, the `http.server.request.duration` metric and the active-requests counter were finalized as soon as the handler returned. For `stream()` / `streamSSE()` responses that is before the body has been sent, so long-running streams were reported as near-instant requests and errors thrown mid-stream were lost. The middleware now wraps the response body and finalizes once it has been fully sent, errors, or the client cancels. Body-less responses, HEAD requests and errors still finalize immediately.
