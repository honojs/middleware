---
'@hono/oidc-auth': patch
---

Fix `getAuth()` swallowing `revokeSession()` failures: the call was invoked without `await` inside the refresh branch, so a rejecting `revokeSession` turned into an unhandled rejection and `getAuth()` returned `null` without surfacing the error. Await the call inside a try/catch so errors are observable and the session is cleaned up consistently.
