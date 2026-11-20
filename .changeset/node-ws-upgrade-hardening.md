---
'@hono/node-ws': patch
---

fix(node-ws): harden the upgrade listener against malformed requests. A request-target that is not a valid URL no longer crashes the process, the host now comes from the `Host` header, backslashes and non-WebSocket upgrades are rejected, and a closed socket no longer throws.
