import { serve } from '@hono/node-server'
import type { ServerType } from '@hono/node-server/dist/types'
import { Hono } from 'hono'
import { WebSocket } from 'ws'
import { createNodeWebSocket } from '.'

describe('WebSocket helper', () => {
  let app: Hono
  let server: ServerType
  let injectWebSocket: ReturnType<typeof createNodeWebSocket>['injectWebSocket']
  let upgradeWebSocket: ReturnType<typeof createNodeWebSocket>['upgradeWebSocket']

  beforeEach(async () => {
    app = new Hono()
    ;({ injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app }))

    server = await new Promise<ServerType>((resolve) => {
      const server = serve({ fetch: app.fetch, port: 3030 }, () => resolve(server))
    })
    injectWebSocket(server)
  })

  afterEach(() => {
    server.close()
  })

  it('Should be able to connect', async () => {
    const mainPromise = new Promise<boolean>((resolve) =>
      app.get(
        '/',
        upgradeWebSocket(() => ({
          onOpen() {
            resolve(true)
          },
        }))
      )
    )

    new WebSocket('ws://localhost:3030/')

    expect(await mainPromise).toBe(true)
  })

  it('Should be able to send and receive messages', async () => {
    const mainPromise = new Promise((resolve) =>
      app.get(
        '/',
        upgradeWebSocket(() => ({
          onMessage(data) {
            resolve(data.data)
          },
        }))
      )
    )

    const ws = new WebSocket('ws://localhost:3030/')
    await new Promise<void>((resolve) => ws.on('open', resolve))
    ws.send('Hello')

    expect(await mainPromise).toBe('Hello')
  })

  it('Should handle multiple concurrent connections', async () => {
    const connectionCount = 5
    let openConnections = 0
    const messages: string[] = []

    app.get(
      '/',
      upgradeWebSocket(() => ({
        onOpen() {
          openConnections++
        },
        onMessage(data, ws) {
          messages.push(data.data as string)
          ws.send(data.data as string)
        },
      }))
    )

    const connections = await Promise.all(
      Array(connectionCount)
        .fill(null)
        .map(async () => {
          const ws = new WebSocket('ws://localhost:3030/')
          await new Promise<void>((resolve) => ws.on('open', resolve))
          return ws
        })
    )

    expect(openConnections).toBe(connectionCount)

    await Promise.all(
      connections.map((ws, index) => {
        return new Promise<void>((resolve) => {
          ws.send(`Hello from connection ${index + 1}`)
          ws.on('message', () => resolve())
        })
      })
    )

    expect(messages.length).toBe(connectionCount)
    messages.forEach((msg, index) => {
      expect(msg).toBe(`Hello from connection ${index + 1}`)
    })

    connections.forEach((ws) => ws.close())
  })
})
