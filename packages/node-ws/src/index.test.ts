import { serve } from '@hono/node-server'
import type { ServerType } from '@hono/node-server/dist/types'
import { Hono } from 'hono'
import { WebSocket } from 'ws'
import { createNodeWebSocket } from '.'

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
