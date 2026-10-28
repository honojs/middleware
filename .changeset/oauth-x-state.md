---
'@hono/oauth-providers': patch
---

Reject an X callback without `state`, and set the `state` and `code-verifier` cookies with `Secure` and `SameSite=Lax`, matching the other providers
