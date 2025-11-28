import { Hono } from 'hono'
import { upgradeWebSocket } from 'hono/deno'
import { newRpcResponse } from '../../src/index.ts'
import { MyApiServer } from './my-api-server.ts'

const app = new Hono()

app.all('/api', (c) => {
  return newRpcResponse(c, new MyApiServer(), {
    upgradeWebSocket,
  })
})

export default app
