# Hono MCP (Model Context Protocol)

Connect Hono with a Model Context Protocol (MCP) server over HTTP Streaming Transport.

## Usage

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPTransport } from '@hono/mcp'
import { Hono } from 'hono'

const app = new Hono();

// Your MCP server implementation
const mcpServer = new McpServer({
 name: "my-mcp-server",
 version: "1.0.0",
});

app.all("/mcp", async (c) => {
 const transport = new StreamableHTTPTransport();
 await mcpServer.connect(transport);
 return transport.handleRequest(c);
});

export default app
```

## Author

Aditya Mathur <https://github.com/mathuraditya724>

## License

MIT
