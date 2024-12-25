/* eslint-disable @typescript-eslint/no-explicit-any */
import { _deserializeData, _serializeData, _verifySerializable } from '@builder.io/qwik'
import { setServerPlatform } from '@builder.io/qwik/server'
import type {
  ServerRenderOptions,
  ServerRequestEvent,
} from '@builder.io/qwik-city/middleware/request-handler'
import {
  mergeHeadersCookies,
  requestHandler,
} from '@builder.io/qwik-city/middleware/request-handler'

import type { MiddlewareHandler } from 'hono'

export const qwikMiddleware = (opts: ServerRenderOptions): MiddlewareHandler => {
  ;(globalThis as any).TextEncoderStream = TextEncoderStream
  const qwikSerializer = {
    _deserializeData,
    _serializeData,
    _verifySerializable,
  }
  if (opts.manifest) {
    setServerPlatform(opts.manifest)
  }
  return async (c, next) => {
    const url = new URL(c.req.url)
    const serverRequestEv: ServerRequestEvent<Response> = {
      mode: 'server',
      locale: undefined,
      url,
      request: c.req.raw,
      getWritableStream: (status, headers, cookies, resolve) => {
        const { readable, writable } = new TransformStream()
        const response = new Response(readable, {
          status,
          headers: mergeHeadersCookies(headers, cookies),
        })
        resolve(response)
        return writable
      },
      getClientConn: () => ({}),
      platform: {},
      env: c.env,
    }
    const handledResponse = await requestHandler(serverRequestEv, opts, qwikSerializer)
    if (handledResponse) {
      handledResponse.completion.then((v) => {
        if (v) {
          console.error(v)
        }
      })
      const response = await handledResponse.response
      if (response) {
        return response
      }
    }
    await next()
  }
}

const resolved = Promise.resolve()

class TextEncoderStream {
  // minimal polyfill implementation of TextEncoderStream
  _writer: any
  readable: any
  writable: any

  constructor() {
    this._writer = null
    this.readable = {
      pipeTo: (writableStream: any) => {
        this._writer = writableStream.getWriter()
      },
    }
    this.writable = {
      getWriter: () => {
        if (!this._writer) {
          throw new Error('No writable stream')
        }
        const encoder = new TextEncoder()
        return {
          write: async (chunk: any) => {
            if (chunk != null) {
              await this._writer.write(encoder.encode(chunk))
            }
          },
          close: () => this._writer.close(),
          ready: resolved,
        }
      },
    }
  }
}
