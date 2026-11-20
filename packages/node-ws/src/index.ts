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

const rejectUpgradeRequest = (socket: Duplex, status: number) => {
  if (socket.destroyed) {
    return
  }
  socket.end(
    `HTTP/1.1 ${status.toString()} ${STATUS_CODES[status] ?? ''}\r\n` +
      'Connection: close\r\n' +
      'Content-Length: 0\r\n' +
      '\r\n'
  )
}

const validateRequestTarget = (target: string): void => {
  const backslash = target.indexOf('\\')
  if (backslash !== -1) {
    const query = target.indexOf('?')
    if (query === -1 || backslash < query) {
      throw new Error('Backslash in request path')
    }
  }
}

const createUpgradeUrl = (request: IncomingMessage, baseUrl?: string | URL): URL => {
  const target = request.url ?? '/'
  validateRequestTarget(target)
  if (target.startsWith('http://') || target.startsWith('https://')) {
    return new URL(target)
  }
  if (target[0] !== '/') {
    throw new Error('Invalid request target')
  }
  if (baseUrl) {
    return new URL(new URL(baseUrl).origin + target)
  }
  const protocol = (request.socket as { encrypted?: boolean }).encrypted ? 'https' : 'http'
  const base = new URL(`${protocol}://${request.headers.host ?? 'localhost'}`)
  if (base.username || base.password || base.pathname !== '/' || base.search || base.hash) {
    throw new Error('Invalid host header')
  }
  return new URL(base.origin + target)
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
    {
      resolve: (ws: WebSocket) => void
      reject: (reason: Error) => void
      connectionSymbol: symbol
    }
  >()

  wss.on('connection', (ws, request) => {
    const waiter = waiterMap.get(request)
    if (waiter) {
      waiter.resolve(ws)
      waiterMap.delete(request)
    }
  })

  const rejectWaiter = (request: IncomingMessage) => {
    const waiter = waiterMap.get(request)
    if (waiter) {
      waiterMap.delete(request)
      waiter.reject(new Error('WebSocket handshake aborted'))
    }
  }

  const nodeUpgradeWebSocket = (request: IncomingMessage, connectionSymbol: symbol) => {
    return new Promise<WebSocket>((resolve, reject) => {
      waiterMap.set(request, { resolve, reject, connectionSymbol })
    })
  }

  return {
    wss,
    injectWebSocket(server) {
      server.on('upgrade', async (request, socket: Duplex, head) => {
        if (request.headers.upgrade?.toLowerCase() !== 'websocket') {
          if (server.listenerCount('upgrade') === 1) {
            rejectUpgradeRequest(socket, 400)
          }
          return
        }

        const ignoreSocketError = () => {}
        const reclaimWaiterOnClose = () => rejectWaiter(request)
        socket.on('error', ignoreSocketError)
        socket.once('close', reclaimWaiterOnClose)

        let url: URL
        try {
          url = createUpgradeUrl(request, init.baseUrl)
        } catch {
          rejectUpgradeRequest(socket, 400)
          return
        }

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

        let response: Response
        try {
          response = await init.app.request(url, { headers: headers }, env)
        } catch {
          rejectWaiter(request)
          rejectUpgradeRequest(socket, 500)
          return
        }

        if (socket.destroyed) {
          rejectWaiter(request)
          return
        }

        const waiter = waiterMap.get(request)

        if (!waiter || waiter.connectionSymbol !== env[CONNECTION_SYMBOL_KEY]) {
          rejectWaiter(request)
          rejectUpgradeRequest(socket, response.status)
          return
        }

        wss.handleUpgrade(request, socket, head, (ws) => {
          socket.off('close', reclaimWaiterOnClose)
          socket.off('error', ignoreSocketError)
          wss.emit('connection', ws, request)
        })
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
        let ws: WebSocket
        try {
          ws = await nodeUpgradeWebSocket(c.env.incoming, connectionSymbol)
        } catch {
          return
        }

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
