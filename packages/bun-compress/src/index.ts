/**
 * @module
 * Compress Middleware for Hono.
 */

import type { MiddlewareHandler } from 'hono'
import { compress as originalCompress } from 'hono/compress'
import { COMPRESSIBLE_CONTENT_TYPE_REGEX } from 'hono/utils/compress'
import { Readable } from 'node:stream'
import type { ReadableStream } from 'node:stream/web'
import { createDeflate, createGzip } from 'node:zlib'

const ENCODING_TYPES = ['gzip', 'deflate'] as const
const cacheControlNoTransformRegExp = /(?:^|,)\s*?no-transform\s*?(?:,|$)/i

interface CompressionOptions {
  encoding?: (typeof ENCODING_TYPES)[number]
  threshold?: number
}

/**
 * Compress Middleware for Hono on Bun.
 *
 * Bun does not currently support CompressionStream, so this uses the zlib module to compress the response body.
 *
 * @see {@link https://hono.dev/docs/middleware/builtin/compress}
 * @see {@link https://github.com/oven-sh/bun/issues/1723}
 *
 * @param {CompressionOptions} [options] - The options for the compress middleware.
 * @param {'gzip' | 'deflate'} [options.encoding] - The compression scheme to allow for response compression. Either 'gzip' or 'deflate'. If not defined, both are allowed and will be used based on the Accept-Encoding header. 'gzip' is prioritized if this option is not provided and the client provides both in the Accept-Encoding header.
 * @param {number} [options.threshold=1024] - The minimum size in bytes to compress. Defaults to 1024 bytes.
 * @returns {MiddlewareHandler} The middleware handler function.
 *
 * @example
 * ```ts
 * const app = new Hono()
 *
 * app.use(bunCompress())
 * ```
 */
export const compress = (options?: CompressionOptions): MiddlewareHandler => {
  // Check CompressionStream support
  if (typeof CompressionStream !== 'undefined') {
    return originalCompress(options)
  }

  const threshold = options?.threshold ?? 1024

  return async function compress(ctx, next) {
    await next()

    const contentLength = ctx.res.headers.get('Content-Length')

    // Check if response should be compressed
    if (
      ctx.res.headers.has('Content-Encoding') || // already encoded
      ctx.res.headers.has('Transfer-Encoding') || // already encoded or chunked
      ctx.req.method === 'HEAD' || // HEAD request
      (contentLength && Number(contentLength) < threshold) || // content-length below threshold
      !shouldCompress(ctx.res) || // not compressible type
      !shouldTransform(ctx.res) // cache-control: no-transform
    ) {
      return
    }

    const accepted = ctx.req.header('Accept-Encoding')
    const encoding =
      options?.encoding ?? ENCODING_TYPES.find((encoding) => accepted?.includes(encoding))
    if (!encoding || !ctx.res.body) {
      return
    }

    // Compress the response
    try {
      const compressedStream = encoding === 'gzip' ? createGzip() : createDeflate()

      const readableBody = ctx.res.body as ReadableStream
      const readableStream = Readable.fromWeb(readableBody)
      const compressedBody = readableStream.pipe(compressedStream)
      const compressedReadableStream = Readable.toWeb(compressedBody) as ReadableStream<Uint8Array>

      // Create a new response with the compressed body
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ctx.res = new Response(compressedReadableStream as any, ctx.res)
      ctx.res.headers.delete('Content-Length')
      ctx.res.headers.set('Content-Encoding', encoding)
    } catch (error) {
      console.error('Compression error:', error)
    }
  }
}

const shouldCompress = (res: Response) => {
  const type = res.headers.get('Content-Type')
  return type && COMPRESSIBLE_CONTENT_TYPE_REGEX.test(type)
}

const shouldTransform = (res: Response) => {
  const cacheControl = res.headers.get('Cache-Control')
  // Don't compress for Cache-Control: no-transform
  // https://tools.ietf.org/html/rfc7234#section-5.2.2.4
  return !cacheControl || !cacheControlNoTransformRegExp.test(cacheControl)
}
