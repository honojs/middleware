---
'@hono/node-ws': patch
---

Fix: forward Hono response headers (e.g., `Set-Cookie`, custom auth headers)
to WebSocket upgrade responses so headers set by middleware are not dropped
during the handshake. Hop-by-hop headers (per [RFC 9110 Section 7.6.1](https://www.rfc-editor.org/rfc/rfc9110.html#name-connection))
and headers managed by `ws` are skipped to avoid corrupting the handshake.
