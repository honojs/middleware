import { Hono } from 'hono'
import { upgradeWebSocket } from 'hono/cloudflare-workers'
import { newRpcResponse } from '../../src'
import { MyApiServer } from './my-api-server'

const app = new Hono()

app.all('/api', (c) => {
  return newRpcResponse(c, new MyApiServer(), {
    upgradeWebSocket,
  })
})

export default app
