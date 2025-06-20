import type { Context } from 'hono'
import { SSEStreamingApi } from 'hono/streaming'

let isOldBunVersion = (): boolean => {
  // @ts-expect-error @types/bun is not installed
  const version: string = typeof Bun !== 'undefined' ? Bun.version : undefined
  if (version === undefined) {
    return false
  }
  const result = version.startsWith('1.1') || version.startsWith('1.0') || version.startsWith('0.')
  // Avoid running this check on every call
  isOldBunVersion = () => result
  return result
}

const run = async (
  stream: SSEStreamingApi,
  cb: (stream: SSEStreamingApi) => Promise<void>,
  onError?: (e: Error, stream: SSEStreamingApi) => Promise<void>
): Promise<void> => {
  try {
    await cb(stream)
  } catch (e) {
    if (e instanceof Error && onError) {
      await onError(e, stream)

      await stream.writeSSE({
        event: 'error',
        data: e.message,
      })
    } else {
      console.error(e)
    }
  }
}

const contextStash: WeakMap<ReadableStream, Context> = new WeakMap<ReadableStream, Context>()

export const streamSSE = (
  c: Context,
  cb: (stream: SSEStreamingApi) => Promise<void>,
  onError?: (e: Error, stream: SSEStreamingApi) => Promise<void>
): Response => {
  const { readable, writable } = new TransformStream()
  const stream = new SSEStreamingApi(writable, readable)

  // Until Bun v1.1.27, Bun didn't call cancel() on the ReadableStream for Response objects from Bun.serve()
  if (isOldBunVersion()) {
    c.req.raw.signal.addEventListener('abort', () => {
      if (!stream.closed) {
        stream.abort()
      }
    })
  }

  // in bun, `c` is destroyed when the request is returned, so hold it until the end of streaming
  contextStash.set(stream.responseReadable, c)

  c.header('Transfer-Encoding', 'chunked')
  c.header('Content-Type', 'text/event-stream')
  c.header('Cache-Control', 'no-cache')
  c.header('Connection', 'keep-alive')

  run(stream, cb, onError)

  return c.newResponse(stream.responseReadable)
}
