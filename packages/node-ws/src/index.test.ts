import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { createNodeWebSocket } from '.'
import { ServerType } from '@hono/node-server/dist/types'
import { WebSocket } from 'ws'

describe('WebSocket helper', () => {
  const app = new Hono()
  const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app })

  const mainPromise = new Promise((resolve) =>
    app.get(
      '/',
      upgradeWebSocket(() => ({
        onOpen() {
          resolve(true)
        },
      }))
    )
  )

  it('Should be able to connect', async () => {
    const server = await new Promise<ServerType>((resolve) => {
      const server = serve(
        {
          fetch: app.fetch,
          port: 3030,
        },
        () => {
          resolve(server)
        }
      )
    })
    injectWebSocket(server)
    const ws = new WebSocket('ws://localhost:3030/')

    expect(await mainPromise).toBe(true)
  })
})