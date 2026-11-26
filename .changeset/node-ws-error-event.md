---
'@hono/node-ws': patch
---

Fix `onError` never being called on Node.js versions without a global `ErrorEvent` (such as 18, 20, and 22), where it threw `ReferenceError: ErrorEvent is not defined`. A fallback is now used, like the existing one for `CloseEvent`.
