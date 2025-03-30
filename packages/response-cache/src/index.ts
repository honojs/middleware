import type { Context, HonoRequest } from 'hono'
import { createMiddleware } from 'hono/factory'

type TOrPromise<T> = T | Promise<T>

interface CacheStore {
  get(key: string): TOrPromise<string | null>
  set(key: string, value: string): TOrPromise<void>
  invalidate(key: string): TOrPromise<void>
}

interface CacheMiddlewareOptions {
  store: CacheStore;
  /**
   * The response type to cache. If not provided, the response will be returned as HTML.
   * @default 'html'
   */
  respond?: 'body' | 'text' | 'json' | 'html';
  /**
   * Function to generate a cache key from the request and context. If not provided, the request path will be used.
   * @param req - The request object.
   * @param c - The context object.
   * @returns A string key for the cache.
   */
  keyFn?: (req: HonoRequest, c: Context) => string;
  logging?: {
    enabled?: boolean;
    onHit?: (key: string, c: Context) => void;
    onMiss?: (key: string, c: Context) => void;
    onError?: (key: string, c: Context, error: unknown) => void;
  };
}
const responseCache = ({ store, keyFn, respond = 'html', logging }: CacheMiddlewareOptions) => {
  return createMiddleware(async (c, next) => {
    const key = keyFn ? keyFn(c.req, c) : c.req.path
    const cached = await store.get(key)
    try {
      if (cached) {
        if (logging?.enabled) {logging.onHit?.(key, c)}
        if (respond === 'json') {
        return c.json(JSON.parse(cached), 200, Object.fromEntries(c.res.headers.entries()))
      }
      else if (respond === 'html') {
        return await c.html(JSON.parse(cached), 200, Object.fromEntries(c.res.headers.entries()))
      }
      else if (respond === 'text') {
        return c.text(JSON.parse(cached), 200, Object.fromEntries(c.res.headers.entries()))
      }
      else if (respond === 'body') {
        return c.body(JSON.parse(cached), 200, Object.fromEntries(c.res.headers.entries()))
      }
    } else {
      if (logging?.enabled) {logging.onMiss?.(key, c)}
      await next()
      const response = await c.res.clone().text()
      await store.set(key, JSON.stringify(response))
    }
    } catch (error) {
      if (logging?.enabled) {logging.onError?.(key, c, error)}
      throw error
    }
  })
}

export { responseCache }
