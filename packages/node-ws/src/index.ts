import { Buffer } from 'buffer'
import type { Server } from 'node:http'
import type { Http2SecureServer, Http2Server } from 'node:http2'
import type { Hono } from 'hono'
import type { UpgradeWebSocket, WSContext } from 'hono/ws'
import type { WebSocket } from 'ws'
import { WebSocketServer } from 'ws'
import type { IncomingMessage } from 'http'

export interface NodeWebSocket {
  upgradeWebSocket: UpgradeWebSocket
  injectWebSocket(server: Server | Http2Server | Http2SecureServer): void
}
export interface NodeWebSocketInit {
  app: Hono
  baseUrl?: string | URL
}

/**
 * Create WebSockets for Node.js
 * @param init Options
 * @returns NodeWebSocket
 */
export const createNodeWebSocket = (init: NodeWebSocketInit): NodeWebSocket => {
  const wss = new WebSocketServer({ noServer: true })
  const waiter = new Map<IncomingMessage, (ws: WebSocket) => void>()

  wss.on('connection', (ws, request) => {
    const waiterFn = waiter.get(request)
    if (waiterFn) {
      waiterFn(ws)
      waiter.delete(request)
    }
  })

  const nodeUpgradeWebSocket = (request: IncomingMessage) => {
    return new Promise<WebSocket>((resolve) => {
      waiter.set(request, resolve)
    })
  }

  return {
    injectWebSocket(server) {
      server.on('upgrade', async (request, socket, head) => {
        const url = new URL(request.url ?? '/', init.baseUrl ?? 'http://localhost')
        const headers = new Headers()
        for (const key in request.headers) {
          const value = request.headers[key]
          if (!value) {
            continue
          }
          headers.append(key, Array.isArray(value) ? value[0] : value)
        }
        await init.app.request(
          url,
          { headers: headers },
          { incoming: request, outgoing: undefined }
        )
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request)
        })
      })
    },
    upgradeWebSocket: (createEvents) =>
      async function upgradeWebSocket(c, next) {
        if (c.req.header('upgrade') !== 'websocket') {
          // Not websocket
          await next()
          return
        }

        ;(async () => {
          const events = await createEvents(c)
          const ws = await nodeUpgradeWebSocket(c.env.incoming)

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
        })()

        return new Response()
      },
  }
}
