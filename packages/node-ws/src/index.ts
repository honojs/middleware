import type { Hono } from 'hono'
import type { UpgradeWebSocket, WSContext } from 'hono/ws'
import type { WebSocket } from 'ws'
import { WebSocketServer } from 'ws'
import type { IncomingMessage } from 'http'
import type { Server } from 'node:http'
import type { Http2SecureServer, Http2Server } from 'node:http2'
import type { Duplex } from 'node:stream'
import { CloseEvent } from './events'

export interface NodeWebSocket {
  upgradeWebSocket: UpgradeWebSocket<WebSocket>
  injectWebSocket(server: Server | Http2Server | Http2SecureServer): void
}
export interface NodeWebSocketInit {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app: Hono<any, any, any>
  baseUrl?: string | URL
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
    { resolve: (ws: WebSocket) => void; response: Response }
  >()

  wss.on('connection', (ws, request) => {
    const waiter = waiterMap.get(request)
    if (waiter) {
      waiter.resolve(ws)
      waiterMap.delete(request)
    }
  })

  const nodeUpgradeWebSocket = (request: IncomingMessage, response: Response) => {
    return new Promise<WebSocket>((resolve) => {
      waiterMap.set(request, { resolve, response })
    })
  }

  return {
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

        const response = await init.app.request(
          url,
          { headers: headers },
          { incoming: request, outgoing: undefined }
        )

        const waiter = waiterMap.get(request)
        if (!waiter || waiter.response !== response) {
          socket.end(
            'HTTP/1.1 400 Bad Request\r\n' +
              'Connection: close\r\n' +
              'Content-Length: 0\r\n' +
              '\r\n'
          )
          waiterMap.delete(request)
          return
        }

        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request)
        })
      })
    },
    upgradeWebSocket: (createEvents) =>
      async function upgradeWebSocket(c, next) {
        if (c.req.header('upgrade')?.toLowerCase() !== 'websocket') {
          // Not websocket
          await next()
          return
        }

        const response = new Response()
        ;(async () => {
          const ws = await nodeUpgradeWebSocket(c.env.incoming, response)
          const events = await createEvents(c)

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
          events.onOpen?.(new Event('open'), ctx)
          ws.on('message', (data, isBinary) => {
            const datas = Array.isArray(data) ? data : [data]
            for (const data of datas) {
              events.onMessage?.(
                new MessageEvent('message', {
                  data: isBinary
                    ? data instanceof ArrayBuffer
                      ? data
                      : data.buffer
                    : data.toString('utf-8'),
                }),
                ctx
              )
            }
          })
          ws.on('close', () => {
            events.onClose?.(new CloseEvent('close'), ctx)
          })
          ws.on('error', (error) => {
            events.onError?.(
              new ErrorEvent('error', {
                error: error,
              }),
              ctx
            )
          })
        })()

        return response
      },
  }
}
