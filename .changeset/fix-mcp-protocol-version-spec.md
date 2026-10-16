---
'@hono/mcp': patch
---

fix(mcp): align unsupported protocol version status with spec (400) and handle multi-value headers

- Respond with HTTP 400 Bad Request instead of 404 Not Found when receiving an unsupported `MCP-Protocol-Version` header, conforming to the Streamable HTTP specification.
- Handle repeated headers combined into comma-separated strings by WHATWG `Headers.get()`:
  - Reject duplicate `Mcp-Session-Id` headers with HTTP 400 Bad Request.
  - Resolve multiple `MCP-Protocol-Version` values to the last specified version.
