# Auth.js middleware for Hono

[![codecov](https://codecov.io/github/honojs/middleware/graph/badge.svg?flag=auth-js)](https://codecov.io/github/honojs/middleware)

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
AUTH_URL=https://example.com/api/auth
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

## Middleware

You can separate this code into another file, say `auth.config.ts`:

```ts
function getAuthConfig(c: Context): AuthConfig {
  return {
    secret: c.env.AUTH_SECRET,
    providers: [
      GitHub({
        clientId: c.env.GITHUB_ID,
        clientSecret: c.env.GITHUB_SECRET,
      }),
    ],
  }
}
```

Use the same config in `middleware.ts`

```ts
import { getAuthConfig } from '@/auth.config'
import { getAuthUser, initAuthConfig } from '@hono/auth-js'
import { Hono } from 'hono'
import { handle } from 'hono/vercel'
import { NextResponse } from 'next/server'

const app = new Hono()

// shared config
app.use('*', initAuthConfig(getAuthConfig))

app.all('*', async (c) => {
  // Retrieve the user & session
  const authUser = await getAuthUser(c)

  const pathname = new URL(c.req.url).pathname
  const isAuthenticated = !!authUser?.session

  // Specific to Auth.js (may vary if customized)
  const isApiAuthRoute = pathname.startsWith('/api/auth')

  const isPublicRoute = ['/'].includes(pathname)
  const isAuthRoute = ['/sign-in'].includes(pathname)

  if (isApiAuthRoute) return NextResponse.next()

  if (isAuthRoute) {
    if (isAuthenticated) {
      return Response.redirect(new URL('/protected', c.req.url))
    }
    return NextResponse.next()
  }

  if (!isAuthenticated && !isPublicRoute) {
    return Response.redirect(new URL('/sign-in', c.req.url))
  }

  return NextResponse.next()
})

export default handle(app)

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
}
```

Middleware setup repo: https://github.com/mohit4bug/nextjs-hono-authjs

## Author

Divyam <https://github.com/divyam234>

## Contributors

-   Mohit <https://github.com/mohit4bug>
    -   Updated the README.md to include additional details about using middleware.