# WebSocket helper for Node.js

[![codecov](https://codecov.io/github/honojs/middleware/graph/badge.svg?flag=node-ws)](https://codecov.io/github/honojs/middleware)

A WebSocket helper for Node.js

## Usage

```ts
import { createNodeWebSocket } from '@hono/node-ws'
import { Hono } from 'hono'
import { serve } from '@hono/node-server'

const app = new Hono()

const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app })

app.get(
  '/ws',
  upgradeWebSocket((c) => ({
    // https://hono.dev/helpers/websocket
  }))
)

const server = serve(app)
injectWebSocket(server)
```

## Options

You can pass options to the underlying WebSocketServer from the `ws` library:

```ts
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({
  app,
  websocketServerOptions: {
    maxPayload: 1024 * 1024, // 1MB max message size
    perMessageDeflate: false, // Disable compression
    clientTracking: true, // Track connected clients
    // ... other ws.ServerOptions
  },
})
```

Available options include:

- `maxPayload`: Maximum allowed message size in bytes
- `perMessageDeflate`: Enable/disable per-message compression
- `clientTracking`: Enable/disable client tracking
- `verifyClient`: Function to verify client connections
- And more - see [ws documentation](https://github.com/websockets/ws/blob/master/doc/ws.md#new-websocketserveroptions-callback) for full list

**Note:** The `noServer` option is always set to `true` internally and cannot be overridden.

## Author

Shotaro Nakamura <https://github.com/nakasyou>

## License

MIT
