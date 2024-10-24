---
'@hono/sentry': major
---

Adds a configuration so that the user can filter which `HTTPException`s are reported to Sentry. By default, if the error is an `HTTPException` instance, only those with status codes between 500 and 599 are reported to Sentry.
