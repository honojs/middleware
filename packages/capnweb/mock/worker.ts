import { RpcTarget } from 'capnweb'
import { Hono } from 'hono'
import { upgradeWebSocket } from 'hono/cloudflare-workers'
import { newRpcResponse } from '../src/index'

export interface PublicApi {
  hello(name: string): string
}

class MyApiServer extends RpcTarget implements PublicApi {
  hello(name: string) {
    return `Hello, ${name}!`
  }
}

const app = new Hono()

app.all('/api', (c) => {
  return newRpcResponse(c, new MyApiServer(), {
    upgradeWebSocket,
  })
})

export default app
