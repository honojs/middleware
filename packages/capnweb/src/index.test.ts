import { serve } from '@hono/node-server'
import type { ServerType } from '@hono/node-server'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore @hono/node-ws may not be typed
import { createNodeWebSocket } from '@hono/node-ws'
import { RpcTarget, newWebSocketRpcSession } from 'capnweb'
import { Hono } from 'hono'
import { WebSocket } from 'ws'
import { newRpcResponse } from './index'

class MyApiServer extends RpcTarget {
  hello(name: string) {
    return `Hello, ${name}!`
  }
}

describe("Cap'n Web middleware - Node.js", () => {
  let app: Hono
  let server: ServerType
  let port: number
  let upgradeWebSocket: ReturnType<typeof createNodeWebSocket>['upgradeWebSocket']

  beforeEach(async () => {
    app = new Hono()

    const { injectWebSocket, upgradeWebSocket: upgrade } = createNodeWebSocket({ app })
    upgradeWebSocket = upgrade

    app.all('/api', (c) => {
      return newRpcResponse(c, new MyApiServer(), { upgradeWebSocket })
    })

    app.all('/no-upgrade', (c) => {
      return newRpcResponse(c, new MyApiServer())
    })

    server = await new Promise<ServerType>((resolve) => {
      const srv = serve({ fetch: app.fetch, port: 0 }, () => {
        resolve(srv)
      })
    })

    injectWebSocket(server)
    const address = server.address()
    port = typeof address === 'object' && address ? address.port : 0
  })

  afterEach(() => {
    server?.close()
  })

  it('can accept WebSocket RPC connections in Node.js', async () => {
    const ws = new WebSocket(`ws://localhost:${port}/api`)

    await new Promise<void>((resolve, reject) => {
      ws.on('open', resolve)
      ws.on('error', reject)
    })

    const cap = newWebSocketRpcSession<MyApiServer>(ws as any)
    expect(await cap.hello('Node.js')).toBe('Hello, Node.js!')
    ws.close()
  })

  it('should return 400 when WebSocket upgrade requested without upgradeWebSocket option', async () => {
    const response = await fetch(`http://localhost:${port}/no-upgrade`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ test: 'data' }),
    })
    expect(response.status).not.toBe(400)
  })
})
