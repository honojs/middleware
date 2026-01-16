---
"@hono/clerk-auth": minor
---

Introduces machine authentication, supporting four token types: `api_key`, `oauth_token`, `machine_token`, and `session_token`. For backwards compatibility, `session_token` remains the default when no token type is specified. This enables machine-to-machine authentication and use cases such as API keys and OAuth integrations. Existing applications continue to work without modification.

You can specify which token types are allowed by using the `acceptsToken` option in the `getAuth()` function. This option can be set to a specific type, an array of types, or `'any'` to accept all supported tokens.

Example usage:

```ts
import { clerkMiddleware, getAuth } from '@hono/clerk-auth'
import { Hono } from 'hono'

const app = new Hono()

app.use('*', clerkMiddleware())
app.get('/api/protected', (c) => {
  const auth = getAuth(c, { acceptsToken: 'any' })

  if (!auth.isAuthenticated) {
    // do something for unauthenticated requests
  }

  if (authObject.tokenType === 'session_token') {
    console.log('this is session token from a user')
  } else {
    console.log('this is some other type of machine token')
    console.log('more specifically, a ' + authObject.tokenType)
  }
})
```
