---
'@hono/mcp': patch
---

Enhance MCP HTTP Streaming Transport reliability and performance

**SSE Write Concurrency Fixes:**
- Implement queue-based write management to prevent stream corruption
- Add `#queueWrite` method for sequential async write processing
- Prevent concurrent writes that could break SSE streams

**Message Size and Queue Management:**
- Add `maxMessageSize` option (default 1MB) with proper validation
- Add `maxQueueSize` option (default 100) to prevent memory issues
- Fix multi-byte character size measurement using TextEncoder instead of Buffer

**Backpressure and Error Handling:**
- Add `writing` flag to prevent recursive write operations
- Implement proper error handling for queue size overflow
- Separate queue management per stream for better isolation

**Resource Management Improvements:**
- Add `cleaned` flag for idempotent cleanup operations
- Improve stream disconnect handling and resource cleanup
- Restore debug logs for better development visibility
