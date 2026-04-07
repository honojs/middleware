---
'@hono/clerk-auth': patch
---

Deprecate `@hono/clerk-auth` in favor of the official `@clerk/hono` package. To migrate, update your imports:

```diff
- import { clerkMiddleware, getAuth } from '@hono/clerk-auth'
+ import { clerkMiddleware, getAuth } from '@clerk/hono'
```
