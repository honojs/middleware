# Hono MCP (Model Context Protocol)

Connect Hono to a Model Context Protocol (MCP) server over HTTP Streaming Transport.

## Streamable HTTP Transport

```ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPTransport } from '@hono/mcp'
import { Hono } from 'hono'

const app = new Hono()

// Your MCP server implementation
const mcpServer = new McpServer({
  name: 'my-mcp-server',
  version: '1.0.0',
})

// Initialize the transport
const transport = new StreamableHTTPTransport()

app.all('/mcp', async (c) => {
  if (!mcp.isConnected()) {
    // Connect the mcp with the transport
    await mcp.connect(transport)
  }

  return transport.handleRequest(c)
})

export default app
```

## Auth

The simplest way to setup MCP Auth when using 3rd party auth providers.

```ts
import { Hono } from 'hono'
import { simpleMcpAuthRouter } from '@hono/mcp'

const app = new Hono()

app.route(
  '/',
  simpleMcpAuthRouter({
    issuer: '[auth provider domain]',
    resourceServerUrl: new URL('http://localhost:3000/mcp'),
  })
)

// ...
// Logic to connect with the transport
```

For implementing custom auth, check out the docs - <https://honohub.dev/docs/hono-mcp>

## Author

Aditya Mathur <https://github.com/mathuraditya724>

## License

MIT
