# Auth.js middleware for Hono

This is a [Auth.js](https://authjs.dev) third-party middleware for [Hono](https://github.com/honojs/hono).

This middleware can be used to inject the Auth.js session into the request context.

## Installation

```plain
npm i hono @hono/auth-js @auth/core
```

## Configuration

Before starting using the middleware you must set the following environment variables:

```plain
AUTH_SECRET=#required
AUTH_URL=#optional
```

## How to Use

```ts
import { Hono, Context } from 'hono'
import { authHandler, initAuthConfig, verifyAuth, type AuthConfig } from "@hono/auth-js"
import GitHub from "@auth/core/providers/github"

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
import { SessionProvider } from "@hono/auth-js/react"

export default  function App() {

  return (
    <SessionProvider>
       <Children />
    </SessionProvider>
  )
}

function Children() {
  const { data: session, status } = useSession()
  return (
    <div >
     I am {session?.user}
    </div>
  )
}
```
Default `/api/auth` path can be changed to something else but that will also require you to change path in react app.

```tsx
import {SessionProvider,authConfigManager,useSession } from "@hono/auth-js/react"

authConfigManager.setConfig({
  baseUrl: '', //needed  for cross domain setup.
  basePath: '/custom', // if auth route is diff from /api/auth
  credentials:'same-origin' //needed  for cross domain setup
});

export default  function App() {
  return (
    <SessionProvider>
      <Children />
    </SessionProvider>
  )
}

function Children() {
  const { data: session, status } = useSession()
  return (
    <div >
     I am {session?.user}
    </div>
  )
}
```
For cross domain setup as mentioned above you need to set these cors headers in hono along with change in same site cookie attribute.[Read More Here](https://next-auth.js.org/configuration/options#cookies)
``` ts
app.use(
  "*",
  cors({
    origin: (origin) => origin,
    allowHeaders: ["Content-Type"],
    credentials: true,
  })
)
```


SessionProvider is not needed with react query.This wrapper is enough

```ts
const useSession = ()=>{
  const { data ,status } = useQuery({
  queryKey: ["session"],
  queryFn: async () => {
    const res = await fetch("/api/auth/session")
    return res.json();
  },
  staleTime: 5 * (60 * 1000),
  gcTime: 10 * (60 * 1000),
  refetchOnWindowFocus: true,
})
 return { session:data, status }
}
```
> [!WARNING]
> You can't use event updates which SessionProvider provides and session will not be in  sync across tabs if you use react query wrapper but in  RQ5 you can enable this using Broadcast channel (see RQ docs).

Working example repo https://github.com/divyam234/next-auth-hono-react

## Author

Divyam <https://github.com/divyam234>
