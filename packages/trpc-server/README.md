# tRPC Server Middleware for Hono

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

## Author

Yusuke Wada <https://github.com/yusukebe>

## License

MIT
