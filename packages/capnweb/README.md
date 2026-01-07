# Cap'n Web Adapter for Hono

[![codecov](https://codecov.io/github/honojs/middleware/graph/badge.svg?flag=capnweb)](https://codecov.io/github/honojs/middleware)

Cap'n Web Adapter Middleware for [Hono](https://hono.dev). Enables RPC over WebSocket and HTTP with [Cap'n Web](https://github.com/cloudflare/capnweb).

## Installation

```bash
npm install @hono/capnweb capnweb hono
```

## Usage

### Define your RPC API

```ts
import { RpcTarget } from 'capnweb'

export interface PublicApi {
  hello(name: string): string
}

export class MyApiServer extends RpcTarget implements PublicApi {
  hello(name: string) {
    return `Hello, ${name}!`
  }
}
```

### Cloudflare Workers

```ts
import { Hono } from 'hono'
import { upgradeWebSocket } from 'hono/cloudflare-workers'
import { newRpcResponse } from '@hono/capnweb'
import { MyApiServer } from './my-api-server'

const app = new Hono()

app.all('/api', (c) => {
  return newRpcResponse(c, new MyApiServer(), {
    upgradeWebSocket,
  })
})

export default app
```

### Node.js

```ts
import { serve } from '@hono/node-server'
import { createNodeWebSocket } from '@hono/node-ws'
import { Hono } from 'hono'
import { newRpcResponse } from '@hono/capnweb'
import { MyApiServer } from './my-api-server'

const app = new Hono()

const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app })

app.all('/api', (c) => {
  return newRpcResponse(c, new MyApiServer(), {
    upgradeWebSocket,
  })
})

const server = serve({
  port: 8787,
  fetch: app.fetch,
})

injectWebSocket(server)
```

### Deno

```ts
import { Hono } from 'hono'
import { upgradeWebSocket } from 'hono/deno'
import { newRpcResponse } from '@hono/capnweb'
import { MyApiServer } from './my-api-server.ts'

const app = new Hono()

app.all('/api', (c) => {
  return newRpcResponse(c, new MyApiServer(), {
    upgradeWebSocket,
  })
})

export default app
```

### Bun

```ts
import { Hono } from 'hono'
import { upgradeWebSocket, websocket } from 'hono/bun'
import { newRpcResponse } from '@hono/capnweb'
import { MyApiServer } from './my-api-server'

const app = new Hono()

app.all('/api', (c) => {
  return newRpcResponse(c, new MyApiServer(), {
    upgradeWebSocket,
  })
})

export default {
  fetch: app.fetch,
  port: 8787,
  websocket,
}
```

## Client

### WebSocket RPC

```ts
import { newWebSocketRpcSession } from 'capnweb'
import type { PublicApi } from './my-api-server'

using stub = newWebSocketRpcSession<PublicApi>('ws://localhost:8787/api')

console.log(await stub.hello("Cap'n Web"))
```

### HTTP Batch RPC

```ts
import { newHttpBatchRpcSession } from 'capnweb'
import type { PublicApi } from './my-api-server'

const stub = newHttpBatchRpcSession<PublicApi>('http://localhost:8787/api')

console.log(await stub.hello("Cap'n Web"))
```

## Author

Yusuke Wada <https://github.com/yusukebe>

## License

MIT
