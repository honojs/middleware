import {
  newHttpBatchRpcResponse,
  newWebSocketRpcSession,
  newWorkersWebSocketRpcResponse,
} from 'capnweb'
import type { Context } from 'hono'
import type { UpgradeWebSocket } from 'hono/ws'

class WebSocketAdapter extends EventTarget {
  #ws: any

  constructor(ws: any) {
    super()
    this.#ws = ws
  }

  send(...args: []) {
    return this.#ws.send(...args)
  }
  close(...args: []) {
    this.#ws.close(...args)
  }
}

function createWebSocketAdapter(ws: any) {
  return typeof ws.addEventListener === 'function' ? ws : new WebSocketAdapter(ws)
}

export function newRpcResponse(
  c: Context,
  localMain: unknown,
  options?: { upgradeWebSocket?: UpgradeWebSocket }
): Response | Promise<Response> {
  if (c.req.header('upgrade')?.toLowerCase() !== 'websocket') {
    return newHttpBatchRpcResponse(c.req.raw, localMain)
  }

  if (options?.upgradeWebSocket) {
    // Cloudflare Workers uses WebSocketPair directly
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore WebSocketPair is a global in Cloudflare Workers
    if (typeof WebSocketPair !== 'undefined') {
      return newWorkersWebSocketRpcResponse(c.req.raw, localMain)
    }

    // Bun/Deno/Node environments
    let adapter: WebSocketAdapter | undefined
    return options.upgradeWebSocket(() => ({
      onOpen(_event, ws) {
        const webSocket = createWebSocketAdapter(ws.raw || ws)
        adapter = webSocket instanceof WebSocketAdapter ? webSocket : undefined
        newWebSocketRpcSession(webSocket, localMain)
      },
      onMessage(event) {
        adapter?.dispatchEvent(new MessageEvent('message', { data: event.data }))
      },
      onClose(event) {
        adapter?.dispatchEvent(new CloseEvent('close', { code: event.code, reason: event.reason }))
      },
      onError(event) {
        adapter?.dispatchEvent(new ErrorEvent('error', { error: event }))
      },
    }))(c, () => Promise.resolve()) as Promise<Response>
  }

  return new Response('WebSocket not supported', { status: 400 })
}
