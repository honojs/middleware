---
"@hono/oidc-auth": minor
---

Add an optional `oidcAuthRefreshErrorHook`. `getAuth()` otherwise swallows a rejected refresh-token grant (it catches the `oauth4webapi` `ResponseBodyError` / `WWWAuthenticateChallengeError`, deletes the session cookie, and returns `null`), so callers cannot observe *why* a refresh failed. The hook is invoked with the OAuth2 error and the context before the cookie is deleted, letting applications log/meter refresh failures or branch on the specific error (e.g. distinguish a permanent `invalid_grant` from a transient `too_many_requests`), and — since it runs before the redirect and receives the context — optionally set a response header that rides the redirect. The hook is optional and defaults to the current behaviour, so this is fully backward compatible.
