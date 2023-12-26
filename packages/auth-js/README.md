# Next Auth middleware for Hono

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
    ],
    callbacks: {
      jwt({ token, account, profile }) {
       
      },
      async signIn({ user, account, profile, email, credentials }) {
      
        return true
      },
    }
  }
}

export default app
```
Working example repo https://github.com/divyam234/next-auth-hono-react

**For React just import client utils from @hono/auth-js/react**
## Author

Divyam <https://github.com/divyam234>
