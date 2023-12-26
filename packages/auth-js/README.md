# Auth js middleware for Hono

This is a [Auth js](https://next-auth.js.org) third-party middleware for [Hono](https://github.com/honojs/hono).

This middleware can be used to inject the Auth js session into the request context.

## Installation

```plain
npm i hono @hono/auth-js @auth/core
```

## Configuration

Before starting using the middleware you must set the following environment variables:

```plain
AUTH_SECRET=#required
```

## How to Use

```ts
import { Hono ,Context} from 'hono'
import { authHandler, initAuthConfig, verifyAuth, AuthConfig } from "@hono/auth-js"

const app = new Hono()

app.use("*", initAuthConfig(getAuthConfig))

app.use("/api/auth/*", authHandler())

app.use('/api/*', verifyAuth())

app.get('/api/protected', (c) => {
  const auth = c.get("authUser")
  return c.json(auth)
})

function getAuthConfig(c: Context): AuthConfig {
  return {
    secret: c.env.AUTH_SECRET,
    providers: [
      GitHub({
        clientId: c.env.GITHUB_ID,
        clientSecret: c.env.GITHUB_SECRET
      }),
    ]
  }
}

export default app
```

React component
```tsx
import { SessionProvider} from "@hono/auth-js/react"
import Layout from "./layout"

export default  function App() {

  return (
    <SessionProvider>
      <Layout>
      </Layout>
    </SessionProvider>
  )
}
```
Default `/api/auth` path can be changed to something else but that will also require you to change path in react app.

```tsx
import {SessionProvider,authConfigManager } from "@hono/auth-js/react"
import Layout from "./layout"

authConfigManager.setConfig({
  baseUrl: '', //needed only when hono app is on diff domain.
  basePath: '/custom', // if auth route is diff from /api/auth
  credentials:'same-origin' // Set to 'include' if hono is on diff domain otherwise cookies are restricted to 'same-origin'
});

export default  function App() {
  return (
    <SessionProvider>
      <Layout>
      </Layout>
    </SessionProvider>
  )
}

```
Working example repo https://github.com/divyam234/next-auth-hono-react

## Author

Divyam <https://github.com/divyam234>
