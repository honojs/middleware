# Hono MCP (Model Context Protocol)

Connect Hono with a Model Context Protocol (MCP) server over HTTP Streaming Transport.

## Transports

### Stramable Transport

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
    await mcp.connect(transport);
  }
  
  return transport.handleRequest(c)
})

export default app
```

### SSE Transport

```ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { SSEServerTransport } from '@hono/mcp'
import { streamSSE } from "hono/streaming"
import { Hono } from 'hono'

const app = new Hono()

// Your MCP server implementation
const mcpServer = new McpServer({
  name: 'my-mcp-server',
  version: '1.0.0',
})

// Initialize the transport
transport = new SSEServerTransport("/messages");

app.get("/sse", async (c) => {
  if (!mcp.isConnected()) {
    // Connect the mcp with the transport
    await mcp.connect(transport);
  }

  return streamSSE(c, transport.handleStream())
});

/**
 * This is the endpoint where the client will send the messages
 */
app.post("/messages", (c) => transport.handlePostMessage(c));

export default app
```

You will need to wrap this in a Durable Object to have a persistent connection when deploying on Cloudflare

## Auth

```ts
import { Hono } from 'hono';
import { ProxyOAuthServerProvider, mcpAuthRouter } from '@hono/mcp';

const app = new Hono();

const proxyProvider = new ProxyOAuthServerProvider({
  endpoints: {
    authorizationUrl: "https://auth.external.com/oauth2/v1/authorize",
    tokenUrl: "https://auth.external.com/oauth2/v1/token",
    revocationUrl: "https://auth.external.com/oauth2/v1/revoke",
  },
  verifyAccessToken: async (token) => {
    return {
      token,
      clientId: "123",
      scopes: ["openid", "email", "profile"],
    }
  },
  getClient: async (client_id) => {
    return {
      client_id,
      redirect_uris: ["http://localhost:3000/callback"],
    }
  }
})

app.route(mcpAuthRouter({
  provider: proxyProvider,
  issuerUrl: new URL("http://auth.external.com"),
  baseUrl: new URL("http://mcp.example.com"),
  serviceDocumentationUrl: new URL("https://docs.example.com/"),
}))
```

## Author

Aditya Mathur <https://github.com/mathuraditya724>

## License

MIT
