import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js'
import { createHttpProxy, createStdioProxy } from './proxy'

/**
 * Mock Transport implementation for testing proxy wiring
 */
function createMockTransport(): Transport & {
  sentMessages: JSONRPCMessage[]
  triggerMessage: (message: JSONRPCMessage) => void
  triggerClose: () => void
  triggerError: (error: Error) => void
  closed: boolean
  failNextSend: boolean
} {
  const transport: Transport & {
    sentMessages: JSONRPCMessage[]
    triggerMessage: (message: JSONRPCMessage) => void
    triggerClose: () => void
    triggerError: (error: Error) => void
    closed: boolean
    failNextSend: boolean
  } = {
    sentMessages: [],
    closed: false,
    failNextSend: false,

    onclose: undefined,
    onerror: undefined,
    onmessage: undefined,

    async start() {
      // No-op for mock
    },

    async send(message: JSONRPCMessage) {
      if (transport.failNextSend) {
        transport.failNextSend = false
        throw new Error('Mock send failure')
      }
      transport.sentMessages.push(message)
    },

    async close() {
      transport.closed = true
      transport.onclose?.()
    },

    triggerMessage(message: JSONRPCMessage) {
      transport.onmessage?.(message)
    },

    triggerClose() {
      transport.onclose?.()
    },

    triggerError(error: Error) {
      transport.onerror?.(error)
    },
  }

  return transport
}

const TEST_MESSAGE: JSONRPCMessage = {
  jsonrpc: '2.0',
  method: 'test/method',
  params: { foo: 'bar' },
  id: 'test-1',
}

describe('createHttpProxy', () => {
  describe('message forwarding', () => {
    it('should forward messages from proxy to MCP transport', async () => {
      const mockMcpTransport = createMockTransport()

      const proxyTransport = createHttpProxy({
        type: 'transport',
        transport: mockMcpTransport,
      })

      // Simulate a message arriving on the proxy transport
      proxyTransport.onmessage?.(TEST_MESSAGE)

      // Wait for async send
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(mockMcpTransport.sentMessages).toHaveLength(1)
      expect(mockMcpTransport.sentMessages[0]).toEqual(TEST_MESSAGE)
    })

    it('should forward messages from MCP transport to proxy', async () => {
      const mockMcpTransport = createMockTransport()

      const proxyTransport = createHttpProxy({
        type: 'transport',
        transport: mockMcpTransport,
      })

      // Track messages sent via proxy transport
      const proxySentMessages: JSONRPCMessage[] = []
      const originalSend = proxyTransport.send.bind(proxyTransport)
      proxyTransport.send = async (message: JSONRPCMessage) => {
        proxySentMessages.push(message)
        return originalSend(message)
      }

      // Simulate a message arriving on the MCP transport
      mockMcpTransport.triggerMessage(TEST_MESSAGE)

      // Wait for async send
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(proxySentMessages).toHaveLength(1)
      expect(proxySentMessages[0]).toEqual(TEST_MESSAGE)
    })
  })

  describe('onMessage callback', () => {
    it('should call onMessage with type "proxy" for messages from proxy transport', () => {
      const mockMcpTransport = createMockTransport()
      const onMessagePayloads: { type: string; message: JSONRPCMessage }[] = []

      const proxyTransport = createHttpProxy({
        type: 'transport',
        transport: mockMcpTransport,
        onMessage: (payload) => {
          onMessagePayloads.push(payload)
        },
      })

      // Simulate a message arriving on the proxy transport
      proxyTransport.onmessage?.(TEST_MESSAGE)

      expect(onMessagePayloads).toHaveLength(1)
      expect(onMessagePayloads[0].type).toBe('proxy')
      expect(onMessagePayloads[0].message).toEqual(TEST_MESSAGE)
    })

    it('should call onMessage with type "mcp" for messages from MCP transport', () => {
      const mockMcpTransport = createMockTransport()
      const onMessagePayloads: { type: string; message: JSONRPCMessage }[] = []

      createHttpProxy({
        type: 'transport',
        transport: mockMcpTransport,
        onMessage: (payload) => {
          onMessagePayloads.push(payload)
        },
      })

      // Simulate a message arriving on the MCP transport
      mockMcpTransport.triggerMessage(TEST_MESSAGE)

      expect(onMessagePayloads).toHaveLength(1)
      expect(onMessagePayloads[0].type).toBe('mcp')
      expect(onMessagePayloads[0].message).toEqual(TEST_MESSAGE)
    })

    it('should include sessionId in proxy message payload', () => {
      const mockMcpTransport = createMockTransport()
      const onMessagePayloads: { type: string; sessionId?: string; message: JSONRPCMessage }[] = []

      const proxyTransport = createHttpProxy({
        type: 'transport',
        transport: mockMcpTransport,
        onMessage: (payload) => {
          onMessagePayloads.push(payload)
        },
        proxyTransportOptions: {
          sessionIdGenerator: () => 'test-session-id',
        },
      })

      // Initialize the proxy transport to generate session ID
      // The sessionId is set during initialization, so we need to set it manually for this test
      ;(proxyTransport as { sessionId?: string }).sessionId = 'test-session-id'

      // Simulate a message arriving on the proxy transport
      proxyTransport.onmessage?.(TEST_MESSAGE)

      expect(onMessagePayloads).toHaveLength(1)
      expect(onMessagePayloads[0].sessionId).toBe('test-session-id')
    })
  })

  describe('onError callback', () => {
    it('should call onError with type "mcp" when MCP transport send fails', async () => {
      const mockMcpTransport = createMockTransport()
      mockMcpTransport.failNextSend = true

      const onErrorPayloads: { type: string; error: unknown }[] = []

      const proxyTransport = createHttpProxy({
        type: 'transport',
        transport: mockMcpTransport,
        onError: (payload) => {
          onErrorPayloads.push(payload)
        },
      })

      // Simulate a message arriving on the proxy transport (will fail when forwarding to MCP)
      proxyTransport.onmessage?.(TEST_MESSAGE)

      // Wait for async error handling
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(onErrorPayloads).toHaveLength(1)
      expect(onErrorPayloads[0].type).toBe('mcp')
      expect(onErrorPayloads[0].error).toBeInstanceOf(Error)
    })

    it('should call onError with type "proxy" when proxy transport send fails', async () => {
      const mockMcpTransport = createMockTransport()
      const onErrorPayloads: { type: string; error: unknown }[] = []

      const proxyTransport = createHttpProxy({
        type: 'transport',
        transport: mockMcpTransport,
        onError: (payload) => {
          onErrorPayloads.push(payload)
        },
      })

      // Make proxy transport fail on send
      const originalSend = proxyTransport.send.bind(proxyTransport)
      proxyTransport.send = async () => {
        throw new Error('Mock proxy send failure')
      }

      // Simulate a message arriving on the MCP transport (will fail when forwarding to proxy)
      mockMcpTransport.triggerMessage(TEST_MESSAGE)

      // Wait for async error handling
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(onErrorPayloads).toHaveLength(1)
      expect(onErrorPayloads[0].type).toBe('proxy')
      expect(onErrorPayloads[0].error).toBeInstanceOf(Error)

      // Restore original send
      proxyTransport.send = originalSend
    })

    it('should wire up onerror handlers for both transports', () => {
      const mockMcpTransport = createMockTransport()
      const onErrorPayloads: { type: string; error: unknown }[] = []

      const proxyTransport = createHttpProxy({
        type: 'transport',
        transport: mockMcpTransport,
        onError: (payload) => {
          onErrorPayloads.push(payload)
        },
      })

      // Trigger error on MCP transport
      const mcpError = new Error('MCP error')
      mockMcpTransport.triggerError(mcpError)

      expect(onErrorPayloads).toHaveLength(1)
      expect(onErrorPayloads[0].type).toBe('mcp')
      expect(onErrorPayloads[0].error).toBe(mcpError)

      // Trigger error on proxy transport
      const proxyError = new Error('Proxy error')
      proxyTransport.onerror?.(proxyError)

      expect(onErrorPayloads).toHaveLength(2)
      expect(onErrorPayloads[1].type).toBe('proxy')
      expect(onErrorPayloads[1].error).toBe(proxyError)
    })
  })

  describe('close coordination', () => {
    it('should close proxy transport when MCP transport closes', async () => {
      const mockMcpTransport = createMockTransport()

      const proxyTransport = createHttpProxy({
        type: 'transport',
        transport: mockMcpTransport,
      })

      let proxyCloseCalled = false
      const originalClose = proxyTransport.close.bind(proxyTransport)
      proxyTransport.close = async () => {
        proxyCloseCalled = true
        return originalClose()
      }

      // Simulate MCP transport closing
      mockMcpTransport.triggerClose()

      // Wait for async close
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(proxyCloseCalled).toBe(true)
    })

    it('should close MCP transport when proxy transport closes', async () => {
      const mockMcpTransport = createMockTransport()

      const proxyTransport = createHttpProxy({
        type: 'transport',
        transport: mockMcpTransport,
      })

      // Simulate proxy transport closing
      proxyTransport.onclose?.()

      // Wait for async close
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(mockMcpTransport.closed).toBe(true)
    })

    it('should prevent double-close infinite loop', async () => {
      const mockMcpTransport = createMockTransport()

      const proxyTransport = createHttpProxy({
        type: 'transport',
        transport: mockMcpTransport,
      })

      let proxyCloseCount = 0
      const originalClose = proxyTransport.close.bind(proxyTransport)
      proxyTransport.close = async () => {
        proxyCloseCount++
        return originalClose()
      }

      // Trigger close from MCP side
      mockMcpTransport.triggerClose()

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 50))

      // Should only close once, not enter infinite loop
      expect(proxyCloseCount).toBe(1)
      expect(mockMcpTransport.closed).toBe(false) // MCP transport triggered the close, not closed by proxy
    })

    it('should prevent double-close when proxy closes first', async () => {
      const mockMcpTransport = createMockTransport()

      const proxyTransport = createHttpProxy({
        type: 'transport',
        transport: mockMcpTransport,
      })

      let mcpCloseCount = 0
      const originalClose = mockMcpTransport.close.bind(mockMcpTransport)
      mockMcpTransport.close = async () => {
        mcpCloseCount++
        return originalClose()
      }

      // Trigger close from proxy side
      proxyTransport.onclose?.()

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 50))

      // Should only close MCP transport once
      expect(mcpCloseCount).toBe(1)
    })
  })

  describe('transport options', () => {
    it('should use provided transport when type is "transport"', () => {
      const mockMcpTransport = createMockTransport()

      const proxyTransport = createHttpProxy({
        type: 'transport',
        transport: mockMcpTransport,
      })

      // Verify the proxy transport is returned and wired correctly
      expect(proxyTransport).toBeDefined()
      expect(proxyTransport.onmessage).toBeDefined()
    })

    it('should use provided transport when type is undefined', () => {
      const mockMcpTransport = createMockTransport()

      const proxyTransport = createHttpProxy({
        transport: mockMcpTransport,
      })

      // Verify the proxy transport is returned and wired correctly
      expect(proxyTransport).toBeDefined()
      expect(proxyTransport.onmessage).toBeDefined()
    })
  })
})

describe('createStdioProxy', () => {
  it('should be an async function', () => {
    // Verify createStdioProxy returns a Promise
    expect(createStdioProxy.constructor.name).toBe('AsyncFunction')
  })
})
