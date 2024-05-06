import type { Hono } from 'hono'
import { createMiddleware } from 'hono/factory'
import type { UpgradeWebSocket, WSContext } from 'hono/ws'
import type { Server } from 'node:http'
import type { Http2SecureServer, Http2Server } from 'node:http2'
import { WebSocketServer } from 'ws'
import { Buffer } from 'buffer'

export interface NodeWebSocket {
  upgradeWebSocket: UpgradeWebSocket
  injectWebSocket(server: Server | Http2Server | Http2SecureServer): void
}
export interface NodeWebSocketInit {
  app: Hono
  baseUrl?: string | URL
}

/**
 * Extended for telling WebSocket
 * @internal
 */
class WSResponse extends Response {
  readonly wss: WebSocketServer
  constructor(wss: WebSocketServer) {
    super()
    this.wss = wss
  }
}

/**
 * Create WebSockets for Node.js
 * @param init Options
 * @returns NodeWebSocket
 */
export const createNodeWebSocket = (init: NodeWebSocketInit): NodeWebSocket => {
  return {
    injectWebSocket(server) {
      ;(server as Server).on('upgrade', async (request, socket, head) => {
        const url = new URL(request.url ?? '/', init.baseUrl ?? 'http://localhost')
        const headers = new Headers()
        for (const key in request.headers) {
          const value = request.headers[key]
          if (!value) {
            continue
          }
          headers.append(key, Array.isArray(value) ? value[0] : value)
        }
        const res = (await init.app.request(url, {
          headers: headers,
        })) as Response | WSResponse
        if (!(res instanceof WSResponse)) {
          socket.destroy()
          return
        }
        res.wss.handleUpgrade(request, socket, head, (ws) => {
          res.wss.emit('connection', ws, request)
        })
      })
    },
    upgradeWebSocket: (createEvents) =>
      createMiddleware(async (c, next) => {
        if (c.req.header('upgrade') !== 'websocket') {
          // Not websocket
          await next()
          return
        }
        const wss = new WebSocketServer({ noServer: true })
        const events = await createEvents(c)
        wss.on('connection', (ws) => {
          const ctx: WSContext = {
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
              const buff: Buffer = Buffer.from(data)
              events.onMessage?.(
                new MessageEvent('message', {
                  data: isBinary ? buff.buffer : buff.toString('utf-8'),
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
        })
        return new WSResponse(wss)
      }),
  }
}