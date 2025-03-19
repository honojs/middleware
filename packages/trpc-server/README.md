# tRPC Server Middleware for Hono

[![codecov](https://codecov.io/github/honojs/middleware/graph/badge.svg?flag=trpc-server)](https://codecov.io/github/honojs/middleware)

tRPC Server Middleware adapts a [tRPC](https://trpc.io) server as middleware for Hono.
Hono works on almost any JavaScript runtime, including Cloudflare Workers, Deno, and Bun. So, with this middleware, the same code will run as tRPC server.

## Install

```
npm install @hono/trpc-server
```

## Usage

Router:

```ts
import { initTRPC } from '@trpc/server'
import { z } from 'zod'

const t = initTRPC.create()

const publicProcedure = t.procedure
const router = t.router

export const appRouter = router({
  hello: publicProcedure.input(z.string().nullish()).query(({ input }) => {
    return `Hello ${input ?? 'World'}!`
  }),
})

export type AppRouter = typeof appRouter
```

Hono app using tRPC Server Middleware:

```ts
import { Hono } from 'hono'
import { trpcServer } from '@hono/trpc-server' // Deno 'npm:@hono/trpc-server'
import { appRouter } from './router'

const app = new Hono()

app.use(
  '/trpc/*',
  trpcServer({
    router: appRouter,
  })
)

export default app
```

Client:

```ts
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client'
import type { AppRouter } from './router'

const client = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: 'http://localhost:8787/trpc',
    }),
  ],
})

console.log(await client.hello.query('Hono'))
```

## Context

You can also access `c.env` from hono context from the trpc `ctx`. eg. here's an example using cloudflare D1 binding available as `env.DB`

```ts
import { initTRPC } from '@trpc/server'
import { z } from 'zod'

type Env = {
  DB: D1Database
}
type HonoContext = {
  env: Env
}

const t = initTRPC.context<HonoContext>().create()

const publicProcedure = t.procedure
const router = t.router

export const appRouter = router({
  usersCount: publicProcedure.query(({ input, ctx }) => {
    const result = await ctx.env.DB.prepare('SELECT count(*) from user;').all()
    return result.results[0].count
  }),
})

export type AppRouter = typeof appRouter
```

For further control, you can optionally specify a `createContext` that in this case will receive the hono context as 2nd argument:

```ts
app.use(
  '/trpc/*',
  trpcServer({
    router: appRouter,
    createContext: (_opts, c) => ({
      // c is the hono context
      var1: c.env.MY_VAR1,
      var2: c.req.header('X-VAR2'),
    }),
  })
)
```

## Custom Endpoints

To set up custom endpoints ensure the endpoint parameter matches the middleware's path. This alignment allows `@trpc/server` to accurately extract your procedure paths.

```ts
import { Hono } from 'hono'
import { trpcServer } from '@hono/trpc-server'
import { appRouter } from './router'

const app = new Hono()

// Custom endpoint configuration
app.use(
  '/api/trpc/*',
  trpcServer({
    endpoint: '/api/trpc',
    router: appRouter,
  })
)

export default app
```

## Author

Yusuke Wada <https://github.com/yusukebe>

## License

MIT
