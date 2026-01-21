import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { StreamableHTTPServerTransportOptions } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { WebStandardStreamableHTTPServerTransportOptions } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js'
import { StreamableHTTPTransport } from './streamable-http'

type OnMessagePayload = {
  type: 'mcp' | 'proxy'
  sessionId?: string
  message: JSONRPCMessage
}

type OnErrorPayload = {
  type: 'mcp' | 'proxy'
  error: unknown
}

// Base options shared by both proxies
type BaseProxyOptions = {
  onMessage?: (payload: OnMessagePayload) => void
  onError?: (payload: OnErrorPayload) => void
  proxyTransportOptions?:
    | StreamableHTTPServerTransportOptions
    | WebStandardStreamableHTTPServerTransportOptions
}

// HTTP proxy options
export type HttpProxyOptions = BaseProxyOptions &
  ({ type: 'streamable-http'; url: string } | { type?: 'transport'; transport: Transport })

// Stdio proxy options (Node.js only)
export type StdioProxyOptions = BaseProxyOptions & {
  command: string
  args?: string[]
  env?: Record<string, string>
}

/**
 * Internal helper to wire two transports together for bidirectional message forwarding
 */
function wireTransports(
  mcpTransport: Transport,
  proxyTransport: StreamableHTTPTransport,
  options: BaseProxyOptions
): void {
  function onProxyError(error: unknown) {
    options.onError?.({
      type: 'proxy',
      error,
    })
  }

  function onMCPError(error: unknown) {
    options.onError?.({
      type: 'mcp',
      error,
    })
  }

  // Connecting the 2 transports together
  let transportToMCPClosed = false
  let transportToProxyClosed = false

  proxyTransport.onmessage = (message) => {
    options.onMessage?.({
      type: 'proxy',
      sessionId: proxyTransport.sessionId,
      message,
    })
    mcpTransport.send(message).catch(onMCPError)
  }

  mcpTransport.onmessage = (message: JSONRPCMessage) => {
    options.onMessage?.({
      type: 'mcp',
      message,
    })
    proxyTransport.send(message).catch(onProxyError)
  }

  mcpTransport.onclose = () => {
    if (transportToProxyClosed) {
      return
    }

    transportToMCPClosed = true
    proxyTransport.close().catch(onProxyError)
  }

  proxyTransport.onclose = () => {
    if (transportToMCPClosed) {
      return
    }
    transportToProxyClosed = true
    mcpTransport.close().catch(onMCPError)
  }

  proxyTransport.onerror = onProxyError
  mcpTransport.onerror = onMCPError
}

/**
 * Creates an HTTP proxy that forwards messages between an HTTP-based MCP transport
 * and a StreamableHTTPTransport. This function is synchronous and cross-runtime compatible.
 *
 * @param options - Configuration for the HTTP proxy
 * @returns A StreamableHTTPTransport that acts as a proxy
 */
export function createHttpProxy(options: HttpProxyOptions): StreamableHTTPTransport {
  const mcpTransport =
    options.type === 'streamable-http'
      ? new StreamableHTTPClientTransport(new URL(options.url))
      : options.transport

  const proxyTransport = new StreamableHTTPTransport(options.proxyTransportOptions)
  wireTransports(mcpTransport, proxyTransport, options)
  return proxyTransport
}

/**
 * Creates a stdio proxy that forwards messages between a stdio-based MCP transport
 * and a StreamableHTTPTransport. This function is async and Node.js only.
 *
 * @param options - Configuration for the stdio proxy
 * @returns A Promise that resolves to a StreamableHTTPTransport that acts as a proxy
 */
export async function createStdioProxy(options: StdioProxyOptions): Promise<StreamableHTTPTransport> {
  const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js')
  const mcpTransport = new StdioClientTransport({
    command: options.command,
    args: options.args,
    env: options.env,
    stderr: 'pipe',
  })

  const proxyTransport = new StreamableHTTPTransport(options.proxyTransportOptions)
  wireTransports(mcpTransport, proxyTransport, options)
  return proxyTransport
}
