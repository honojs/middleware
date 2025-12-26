import type { Context, MiddlewareHandler } from 'hono'
import { createMiddleware } from 'hono/factory'
import { encodeBase64, decodeBase64 } from 'hono/utils/encode'

type TOrPromise<T> = T | Promise<T>

interface CacheStore {
  get(key: string): TOrPromise<string | null>
  set(key: string, value: string): TOrPromise<void>
  invalidate(key: string): TOrPromise<void>
}

const EXCLUDED_RESPONSE_HEADERS = new Set([
  'set-cookie',
  'www-authenticate',
  'proxy-authenticate',
  'authentication-info',
  'connection',
  'keep-alive',
  'upgrade',
  'transfer-encoding',
  'te',
  'trailer',
  'via',
  'age',
  'warning',
  'date',
  'vary',
])

function filterHeaders(headers: Headers): Record<string, string> {
  const filtered: Record<string, string> = {}
  headers.forEach((value, key) => {
    if (!EXCLUDED_RESPONSE_HEADERS.has(key.toLowerCase())) {
      filtered[key] = value
    }
  })
  return filtered
}

interface CacheMiddlewareOptions {
  store: CacheStore
  /**
   * Function to generate a cache key from the request and context. If not provided, the request path will be used.
   * @param req - The request object.
   * @param c - The context object.
   * @returns A string key for the cache.
   */
  keyFn?: (c: Context) => string
  logging?: {
    enabled?: boolean
    onHit?: (key: string, c: Context) => void
    onMiss?: (key: string, c: Context) => void
    onError?: (key: string, c: Context, error: unknown) => void
  }
}
const responseCache = ({ store, keyFn, logging }: CacheMiddlewareOptions): MiddlewareHandler => {
  return createMiddleware(async (c, next) => {
    const key = keyFn ? keyFn(c) : c.req.path
    try {
      const cached = await store.get(key)
      if (cached) {
        if (logging?.enabled) {
          logging.onHit?.(key, c)
        }

        const snapshot = JSON.parse(cached)
        const { body, status, headers } = snapshot

        return new Response(decodeBase64(body), {
          status,
          headers,
        })
      } else {
        if (logging?.enabled) {
          logging.onMiss?.(key, c)
        }
        await next()

        const bodyBuffer = await c.res.clone().arrayBuffer()
        const body = encodeBase64(bodyBuffer)
        const status = c.res.status
        const headers = filterHeaders(c.res.headers)

        const snapshot = JSON.stringify({ body, status, headers })
        await store.set(key, snapshot)

        return c.res
      }
    } catch (error) {
      if (logging?.enabled) {
        logging.onError?.(key, c, error)
      }
      throw error
    }
  })
}

export { responseCache }
