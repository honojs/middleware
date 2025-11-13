import { Hono } from 'hono'
import { upgradeWebSocket, websocket } from 'hono/bun'
import { newRpcResponse } from '../../src'
import { MyApiServer } from './my-api-server'

const app = new Hono()

app.all('/api', (c) => {
  return newRpcResponse(c, new MyApiServer(), {
    upgradeWebSocket,
  })
})

export default {
  fetch: app.fetch,
  port: 8787,
  websocket,
}
