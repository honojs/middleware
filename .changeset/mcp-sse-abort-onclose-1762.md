---
"@hono/mcp": patch
---

Call `onclose` when the standalone GET SSE stream aborts so apps can detect client disconnects without relying on DELETE.
