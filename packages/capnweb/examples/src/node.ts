import { serve } from '@hono/node-server'
import { createNodeWebSocket } from '@hono/node-ws'
import { Hono } from 'hono'
import { newRpcResponse } from '../../src'
import { MyApiServer } from './my-api-server'

const app = new Hono()

const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app })

app.all('/api', (c) => {
  return newRpcResponse(c, new MyApiServer(), {
    upgradeWebSocket,
  })
})

const server = serve({
  port: 8787,
  fetch: app.fetch,
})

injectWebSocket(server)
