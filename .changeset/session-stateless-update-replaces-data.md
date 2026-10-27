---
'@hono/session': patch
---

Replace the data stored in a stateless session cookie on `update()` and refresh, so keys removed from the session data are no longer kept in the cookie. In stateless mode, `update()` now replaces the session data instead of merging it with the data already in the cookie, matching the behaviour with `useSessionStorage()`.
