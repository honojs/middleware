import type { Hono } from 'hono'
import { defineWebSocketHelper } from 'hono/ws'
import type { UpgradeWebSocket, WSContext } from 'hono/ws'
import type { WebSocket } from 'ws'
import { WebSocketServer } from 'ws'
import { STATUS_CODES } from 'node:http'
import type { IncomingMessage, Server } from 'node:http'
import type { Http2SecureServer, Http2Server } from 'node:http2'
import type { Duplex } from 'node:stream'
import { CloseEvent } from './events'

export interface NodeWebSocket {
  upgradeWebSocket: UpgradeWebSocket<
    WebSocket,
    {
      onError: (err: unknown) => void
    }
  >
  injectWebSocket(server: Server | Http2Server | Http2SecureServer): void
  wss: WebSocketServer
}
export interface NodeWebSocketInit {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app: Hono<any, any, any>
  baseUrl?: string | URL
}

const generateConnectionSymbol = () => Symbol('connection')

/** @example `c.env[CONNECTION_SYMBOL_KEY]` */
const CONNECTION_SYMBOL_KEY: unique symbol = Symbol('CONNECTION_SYMBOL_KEY')

// Hop-by-hop headers per RFC 9110 Section 7.6.1
// (https://www.rfc-editor.org/rfc/rfc9110.html#name-connection) plus
// `keep-alive` (commonly treated as hop-by-hop by HTTP implementations) and
// WebSocket handshake headers managed by `ws` itself. These must not be
// forwarded onto the upgrade response or the handshake will be corrupted.
const responseHeadersToSkip = new Set([
  'connection',
  'content-length',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'sec-websocket-accept',
  'sec-websocket-extensions',
  'sec-websocket-protocol',
])

const appendResponseHeaders = (headers: string[], responseHeaders: Headers) => {
  responseHeaders.forEach((value, key) => {
    if (responseHeadersToSkip.has(key.toLowerCase())) {
      return
    }
    headers.push(`${key}: ${value}`)
  })
}

/**
 * Create WebSockets for Node.js
 * @param init Options
 * @returns NodeWebSocket
 */
export const createNodeWebSocket = (init: NodeWebSocketInit): NodeWebSocket => {
  const wss = new WebSocketServer({ noServer: true })
  const waiterMap = new Map<
    IncomingMessage,
    { resolve: (ws: WebSocket) => void; connectionSymbol: symbol }
  >()

  wss.on('connection', (ws, request) => {
    const waiter = waiterMap.get(request)
    if (waiter) {
      waiter.resolve(ws)
      waiterMap.delete(request)
    }
  })

  const nodeUpgradeWebSocket = (request: IncomingMessage, connectionSymbol: symbol) => {
    return new Promise<WebSocket>((resolve) => {
      waiterMap.set(request, { resolve, connectionSymbol })
    })
  }

  return {
    wss,
    injectWebSocket(server) {
      server.on('upgrade', async (request, socket: Duplex, head) => {
        const url = new URL(request.url ?? '/', init.baseUrl ?? 'http://localhost')
        const headers = new Headers()
        for (const key in request.headers) {
          const value = request.headers[key]
          if (!value) {
            continue
          }
          headers.append(key, Array.isArray(value) ? value[0] : value)
        }

        const env: {
          incoming: IncomingMessage
          outgoing: undefined
          [CONNECTION_SYMBOL_KEY]?: symbol
        } = {
          incoming: request,
          outgoing: undefined,
        }
        const response = await init.app.request(url, { headers: headers }, env)
        const waiter = waiterMap.get(request)

        if (!waiter || waiter.connectionSymbol !== env[CONNECTION_SYMBOL_KEY]) {
          const responseLines = ['Connection: close', 'Content-Length: 0']
          appendResponseHeaders(responseLines, response.headers)

          socket.end(
            `HTTP/1.1 ${response.status.toString()} ${STATUS_CODES[response.status] ?? ''}\r\n` +
              `${responseLines.join('\r\n')}\r\n` +
              '\r\n'
          )
          waiterMap.delete(request)
          return
        }

        const addResponseHeaders = (headers: string[]) => {
          appendResponseHeaders(headers, response.headers)
        }

        // `headers` is emitted synchronously inside `handleUpgrade`, so this
        // listener cannot leak across concurrent upgrades on the shared `wss`.
        wss.on('headers', addResponseHeaders)
        try {
          wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request)
          })
        } finally {
          wss.off('headers', addResponseHeaders)
        }
      })
    },
    upgradeWebSocket: defineWebSocketHelper(async (c, events, options) => {
      if (c.req.header('upgrade')?.toLowerCase() !== 'websocket') {
        // Not websocket
        return
      }

      const connectionSymbol = generateConnectionSymbol()
      c.env[CONNECTION_SYMBOL_KEY] = connectionSymbol
      ;(async () => {
        const ws = await nodeUpgradeWebSocket(c.env.incoming, connectionSymbol)

        // buffer messages to handle messages received before the events are set up
        const messagesReceivedInStarting: [data: WebSocket.RawData, isBinary: boolean][] = []
        const bufferMessage = (data: WebSocket.RawData, isBinary: boolean) => {
          messagesReceivedInStarting.push([data, isBinary])
        }
        ws.on('message', bufferMessage)

        const ctx: WSContext<WebSocket> = {
          binaryType: 'arraybuffer',
          close(code, reason) {
            ws.close(code, reason)
          },
          protocol: ws.protocol,
          raw: ws,
          get readyState() {
            return ws.readyState
          },
          send(source, opts) {
            ws.send(source, {
              compress: opts?.compress,
            })
          },
          url: new URL(c.req.url),
        }
        try {
          events?.onOpen?.(new Event('open'), ctx)
        } catch (e) {
          ;(options?.onError ?? console.error)(e)
        }

        const handleMessage = (data: WebSocket.RawData, isBinary: boolean) => {
          const datas = Array.isArray(data) ? data : [data]
          for (const data of datas) {
            try {
              events?.onMessage?.(
                new MessageEvent('message', {
                  data: isBinary
                    ? data instanceof ArrayBuffer
                      ? data
                      : data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
                    : data.toString('utf-8'),
                }),
                ctx
              )
            } catch (e) {
              ;(options?.onError ?? console.error)(e)
            }
          }
        }
        ws.off('message', bufferMessage)
        for (const message of messagesReceivedInStarting) {
          handleMessage(...message)
        }

        ws.on('message', (data, isBinary) => {
          handleMessage(data, isBinary)
        })
        ws.on('close', (code, reason) => {
          try {
            events?.onClose?.(new CloseEvent('close', { code, reason: reason.toString() }), ctx)
          } catch (e) {
            ;(options?.onError ?? console.error)(e)
          }
        })
        ws.on('error', (error) => {
          try {
            events?.onError?.(
              new ErrorEvent('error', {
                error: error,
              }),
              ctx
            )
          } catch (e) {
            ;(options?.onError ?? console.error)(e)
          }
        })
      })()

      return new Response()
    }),
  }
}
