import { newHttpBatchRpcSession, newWebSocketRpcSession } from 'capnweb'
import { SELF } from 'cloudflare:test'
import type { PublicApi } from '../mock/worker'

describe("Cap'n Web middleware - workerd", () => {
  it('can accept WebSocket RPC connections', async () => {
    const res = await SELF.fetch('http://foo/api', {
      headers: { Upgrade: 'websocket' },
    })
    expect(res.status).toBe(101)
    const ws = res.webSocket
    ws.accept()
    expect(ws).toBeTruthy()

    const cap = newWebSocketRpcSession<PublicApi>(ws!)
    expect(await cap.hello('Hono')).toBe('Hello, Hono!')
  })

  it('can accept HTTP batch RPC connections', async () => {
    const cap = newHttpBatchRpcSession<PublicApi>(
      new Request('http://foo/api', {
        // @ts-expect-error fetcher is not typed
        fetcher: SELF,
      })
    )
    expect(await Promise.all([cap.hello('Hono')])).toStrictEqual(['Hello, Hono!'])
  })
})
