# Clerk middleware for Hono

This is a [Clerk](https://clerk.com) third-party middleware for [Hono](https://github.com/honojs/hono).

This middleware can be used to inject the active Clerk session into the request context.

## Installation

```plain
npm i hono @hono/clerk-auth @clerk/backend
```

## Configuration

Before starting using the middleware you must set the following environment variables:

```plain
CLERK_SECRET_KEY=<You-secret-key>
CLERK_PUBLISHABLE_KEY=<Your-publishable-key>
```

## How to Use

```ts
import { clerkMiddleware, getAuth } from '@hono/clerk-auth'
import { Hono } from 'hono'

const app = new Hono()

app.use('*', clerkMiddleware())
app.get('/', (c) => {
  const auth = getAuth(c)

  if (!auth?.userId) {
    return c.json({
      message: 'You are not logged in.'
    })
  }

  return c.json({
    message: 'You are logged in!',
    userId: auth.userId
  })
})

export default app
```

## Accessing instance of Backend API client

```ts
import { clerkMiddleware, getAuth } from '@hono/clerk-auth'
import { Hono } from 'hono'

const app = new Hono()

app.use('*', clerkMiddleware())
app.get('/', async (c) => {
  const clerkClient = c.get('clerk')

  try {
    const user = await clerkClient.users.getUser('user_id_....')

    return c.json({
      user,
    })
  } catch (e) {
    return c.json({
      message: 'User not found.'
    }, 404)
  }
})

export default app
```

## Author

Vaggelis Yfantis <https://github.com/octoper>
