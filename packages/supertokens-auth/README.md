# @hono/supertokens

SuperTokens authentication middleware for [Hono](https://hono.dev).

Provides a first-class Hono middleware adapter for [SuperTokens](https://supertokens.com) — an open-source authentication solution that handles email/password login, social (OAuth) login, passwordless, MFA, session management, and more.

SuperTokens does not have a native Hono adapter, so this package uses the `framework/custom` adapter (`PreParsedRequest` / `CollectingResponse`) from `supertokens-node` to bridge the two cleanly.

## Installation

```sh
npm install @hono/supertokens supertokens-node
```

## Quick Start

### 1. Initialise SuperTokens

Call `SuperTokens.init()` once at application startup, **before** defining any routes. Set `framework: 'custom'`.

```ts
// src/config/supertokens.ts
import SuperTokens from 'supertokens-node'
import Session from 'supertokens-node/recipe/session'
import EmailPassword from 'supertokens-node/recipe/emailpassword'

SuperTokens.init({
  framework: 'custom',
  supertokens: {
    connectionURI: process.env.SUPERTOKENS_CONNECTION_URI ?? 'http://localhost:3567',
    // apiKey: process.env.SUPERTOKENS_API_KEY, // required for managed service
  },
  appInfo: {
    appName: 'My App',
    apiDomain: 'http://localhost:3000',
    websiteDomain: 'http://localhost:5173',
    apiBasePath: '/auth',       // SuperTokens routes live here
    websiteBasePath: '/auth',
  },
  recipeList: [
    EmailPassword.init(),
    Session.init(),
  ],
})
```

### 2. Mount the middleware

```ts
// src/index.ts
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import SuperTokens from 'supertokens-node'
import './config/supertokens'           // side-effect: calls SuperTokens.init()
import { superTokensMiddleware, verifySession, getSession } from '@hono/supertokens'

const app = new Hono()

// CORS must come before superTokensMiddleware.
// Include SuperTokens' required headers so the frontend SDK works.
app.use('*', cors({
  origin: 'http://localhost:5173',
  allowHeaders: ['content-type', ...SuperTokens.getAllCORSHeaders()],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
}))

// Mount all SuperTokens auth routes at /auth/*
// (sign-in, sign-up, sign-out, refresh, user info, …)
app.use('/auth/*', superTokensMiddleware())

// Public route
app.get('/', (c) => c.json({ status: 'ok' }))

// Protected route — returns 401 if no valid session
app.get('/me', verifySession(), (c) => {
  const session = getSession(c)
  return c.json({ userId: session.getUserId() })
})

// Route with an optional session
app.get('/feed', verifySession({ sessionRequired: false }), (c) => {
  const session = c.get('session')
  return c.json({
    loggedIn: session !== undefined,
    userId: session?.getUserId(),
  })
})

serve({ fetch: app.fetch, port: 3000 }, () =>
  console.log('Listening on http://localhost:3000')
)
```

## API

### `superTokensMiddleware()`

```ts
import { superTokensMiddleware } from '@hono/supertokens'

app.use('/auth/*', superTokensMiddleware())
```

Intercepts all SuperTokens-managed auth routes (sign-in, sign-up, sign-out, session refresh, etc.) under the configured `apiBasePath`. For any path that SuperTokens does not recognise, the request is passed to the next handler as normal.

**Must be mounted at the same path as `appInfo.apiBasePath`** (default: `/auth/*`).

---

### `verifySession(options?)`

```ts
import { verifySession } from '@hono/supertokens'

// Required session (default)
app.get('/dashboard', verifySession(), handler)

// Optional session
app.get('/profile', verifySession({ sessionRequired: false }), handler)
```

Verifies the caller's session token. On success the `SessionContainer` is stored in the context and is available via `c.get('session')` or `getSession(c)`.

On failure the middleware responds with `401 Unauthorized` automatically:

- **No session / invalid token** → `{ "message": "Unauthorized" }`
- **Expired token** → `{ "message": "Session expired. Please call the session refresh endpoint and retry." }`

`options` accepts any [`VerifySessionOptions`](https://supertokens.com/docs/nodejs/modules/recipe_session.html) from `supertokens-node`.

---

### `getSession(c)`

```ts
import { getSession } from '@hono/supertokens'

app.get('/me', verifySession(), (c) => {
  const session = getSession(c)
  return c.json({ userId: session.getUserId() })
})
```

Convenience helper that retrieves the `SessionContainer` from the context. Throws a descriptive error if called without `verifySession()` in the middleware chain.

You can also access the session directly via `c.get('session')` — the type is automatically inferred through Hono's `ContextVariableMap` augmentation included in this package.

---

## CORS

SuperTokens requires custom headers for its frontend SDK to communicate with your backend. Always:

1. Spread `SuperTokens.getAllCORSHeaders()` into your CORS `allowHeaders` list.
2. Set `credentials: true`.
3. Register the CORS middleware **before** `superTokensMiddleware()`.

```ts
import SuperTokens from 'supertokens-node'
import { cors } from 'hono/cors'

app.use('*', cors({
  origin: 'https://your-frontend.com',
  allowHeaders: ['content-type', ...SuperTokens.getAllCORSHeaders()],
  credentials: true,
}))
```

---

## Adding More Recipes

SuperTokens supports many authentication methods. Add them to `recipeList`:

```ts
import ThirdParty from 'supertokens-node/recipe/thirdparty'
import Passwordless from 'supertokens-node/recipe/passwordless'
import UserRoles from 'supertokens-node/recipe/userroles'

SuperTokens.init({
  framework: 'custom',
  // ...
  recipeList: [
    EmailPassword.init(),
    ThirdParty.init({
      signInAndUpFeature: {
        providers: [
          {
            config: {
              thirdPartyId: 'google',
              clients: [{ clientId: '...', clientSecret: '...' }],
            },
          },
        ],
      },
    }),
    Passwordless.init({
      contactMethod: 'EMAIL',
      flowType: 'USER_INPUT_CODE_AND_MAGIC_LINK',
    }),
    UserRoles.init(),
    Session.init(),
  ],
})
```

---

## Running a SuperTokens Core

You need a running SuperTokens Core for your backend to connect to.

**Docker (quickest):**

```sh
docker run -p 3567:3567 -e DISABLE_TELEMETRY=true registry.supertokens.io/supertokens/supertokens-sqlite
```

Or sign up for the [managed service](https://supertokens.com/dashboard-saas) and use the provided `connectionURI` and `apiKey`.

---

## Runtime Compatibility

This middleware targets Hono's Web Standards API (`Request` / `Response`) and is compatible with:

- **Node.js** (via `@hono/node-server`)
- **Bun**
- **Deno**
- **Cloudflare Workers** — requires `nodejs_compat` flag in `wrangler.toml` since `supertokens-node` needs some Node APIs

---

## Author

Created by the community. See [contributing guide](https://github.com/honojs/middleware/blob/main/README.md#how-to-contribute).

## License

MIT
