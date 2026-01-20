import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { StreamableHTTPServerTransportOptions } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js'
import { StreamableHTTPTransport } from './streamable-http'

type onMessagePayload = {
  type: 'mcp' | 'proxy'
  sessionId?: string
  message: JSONRPCMessage
}

type onErrorPayload = {
  type: 'mcp' | 'proxy'
  error: unknown
}

export type ProxyMCPOptions = (
  | CreateClientTransportOptions
  | { type?: 'transport'; transport: Transport }
) & {
  onMessage?: (payload: onMessagePayload) => void
  onError?: (payload: onErrorPayload) => void
  proxyTransportOptions?: StreamableHTTPServerTransportOptions
}

export function createProxy(options: ProxyMCPOptions): StreamableHTTPTransport {
  const mcpTransport =
    options.type == null || options.type === 'transport'
      ? options.transport
      : createClientTransport(options as CreateClientTransportOptions)
  const proxyTransport = new StreamableHTTPTransport(options.proxyTransportOptions)

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

  return proxyTransport
}

export type CreateClientTransportOptions =
  | {
      type: 'stdio'
      command: string
      args?: string[]
      env?: Record<string, string>
    }
  | {
      type: 'streamable-http'
      url: string
    }

export function createClientTransport(
  options: CreateClientTransportOptions
): StdioClientTransport | StreamableHTTPClientTransport {
  let mcpTransport = undefined

  if (options.type === 'stdio') {
    mcpTransport = new StdioClientTransport({
      command: options.command,
      args: options.args,
      env: options.env,
      stderr: 'pipe',
    })
  } else if (options.type === 'streamable-http') {
    mcpTransport = new StreamableHTTPClientTransport(new URL(options.url))
  }

  if (!mcpTransport) {
    throw new Error('[proxy]: Unsupported transport type')
  }

  return mcpTransport
}
