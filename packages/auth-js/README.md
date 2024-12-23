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
```

## How to Use

```ts
import { Hono } from 'hono'
import { authHandler, initAuthConfig, verifyAuth } from '@hono/auth-js'
import GitHub from '@auth/core/providers/github'

const app = new Hono()

app.use(
  '*',
  initAuthConfig((c) => ({
    secret: c.env.AUTH_SECRET,
    providers: [
      GitHub({
        clientId: c.env.GITHUB_ID,
        clientSecret: c.env.GITHUB_SECRET,
      }),
    ],
    // This is required and should match the path of the authHandler route
    basePath: '/api/auth',
  }))
)

app.use('/api/auth/*', authHandler())

app.use('/api/*', verifyAuth())

app.get('/api/protected', (c) => {
  const auth = c.get('authUser')
  return c.json(auth)
})

export default app
```

React component

```tsx
import { SessionProvider, useSession } from '@hono/auth-js/react'

export default function App() {
  return (
    <SessionProvider>
      <Children />
    </SessionProvider>
  )
}

function Children() {
  const { data: session, status } = useSession()
  return <div>I am {session?.user}</div>
}
```

Default `/api/auth` path can be changed to something else but that will also require you to change path in react app.

```tsx
import { SessionProvider, authConfigManager, useSession } from '@hono/auth-js/react'

authConfigManager.setConfig({
  basePath: '/custom', // if auth route is diff from /api/auth
})

export default function App() {
  return (
    <SessionProvider>
      <Children />
    </SessionProvider>
  )
}

function Children() {
  const { data: session, status } = useSession()
  return <div>I am {session?.user}</div>
}
```

SessionProvider is not needed with react query.Use useQuery hook to fetch session data.

```ts
const useSession = () => {
  const { data, status } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const res = await fetch('/api/auth/session')
      return res.json()
    },
    staleTime: 5 * (60 * 1000),
    gcTime: 10 * (60 * 1000),
    refetchOnWindowFocus: true,
  })
  return { session: data, status }
}
```
For more details on how to Popup Oauth Login see [example](https://github.com/divyam234/next-auth-hono-react)

## Author

Divyam <https://github.com/divyam234>

### Contributors

Catnaut <https://github.com/catnaut>

## Breaking Changes

Due to security concerns, support for `x-forward-*` has been removed starting from version 1.0.15. This change is marked as a breaking change. For more details, refer to issue [#817](https://github.com/honojs/middleware/issues/817).
