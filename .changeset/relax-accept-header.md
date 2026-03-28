---
'@hono/mcp': patch
---

relax Accept header validation to accept `application/json`, `text/event-stream`, or `*/*` individually, improving compatibility with Gemini CLI, Java MCP SDK, Open WebUI, and curl. Add `strictAcceptHeader` option for strict MCP spec compliance.
