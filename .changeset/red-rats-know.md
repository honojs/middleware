---
'@hono/mcp': patch
---

Enhance MCP HTTP Streaming Transport reliability and performance

**SDK Update:**
- Upgrade @modelcontextprotocol/sdk from v1.12.0 to v1.17.2
- Remove fallback type definitions and use official MessageExtraInfo and RequestInfo types
- Improve type safety and compatibility with latest MCP specification

**Event Store and Resumability (based on official SDK):**
- Add built-in MemoryEventStore implementation for connection resumability
- Support Last-Event-ID header for event replay after connection drops
- Automatic event ID generation and storage for all SSE messages
- Improved client resilience during network interruptions

**SSE Write Management:**
- Implement queue-based write management to prevent stream corruption
- Add unified `#writeSSEEvent` method for consistent SSE formatting
- Prevent concurrent writes that could break SSE streams
- Separate queue management per stream for better isolation

**DNS Rebinding Protection (simplified):**
- Simplify host header validation based on official SDK approach  
- Remove complex IPv6 normalization for better maintainability
- Maintain security while improving code clarity

**Message Size and Queue Management:**
- Add `maxMessageSize` option (default 1MB) with proper validation
- Add `maxQueueSize` option (default 100) to prevent memory issues
- Fix multi-byte character size measurement using TextEncoder instead of Buffer

**Backpressure and Error Handling:**
- Add `writing` flag to prevent recursive write operations
- Implement proper error handling for queue size overflow
- Improved resource cleanup with EventStore integration

**Resource Management Improvements:**
- Add `cleaned` flag for idempotent cleanup operations
- Improve stream disconnect handling and resource cleanup
- Restore debug logs for better development visibility
