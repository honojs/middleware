import type { Context } from 'hono'
import type { Storage } from 'unstorage'

export type CacheKeyFn<TArgs extends unknown[]> = (...args: TArgs) => string | Promise<string>

/**
 * Shared cache options for middleware and function caching.
 */
export interface CacheBaseOptions {
  /** Storage namespace prefix. */
  base?: string
  /** Cache group segment (handlers/functions). */
  group?: string
  /** Optional hash function for default keys. */
  hash?: (value: string) => string | Promise<string>
  /** Manual integrity value to invalidate cache. */
  integrity?: string
  /**
   * Keep the previous cache entry when refresh fails with a 5xx-style error.
   * - middleware: preserve previous entry for response status >= 500
   * - function cache: preserve previous entry when wrapped function throws
   * Only applies when `shouldInvalidateCache` is used.
   */
  keepPreviousOn5xx?: boolean
  /** Max age in seconds. */
  maxAge?: number
  /** Cache entry name (used as part of the storage key). */
  name?: string
  /** Custom header name to allow manual cache revalidation. Disabled by default. */
  revalidateHeader?: string | false
  /** Stale max age in seconds. Use -1 for unlimited stale. */
  staleMaxAge?: number
  /** Custom storage instance to use for caching. */
  storage?: Storage
  /** Enable stale-while-revalidate behavior. */
  swr?: boolean
}

/**
 * Global cache defaults applied to middleware and cached functions.
 */
export interface CacheDefaults extends CacheBaseOptions {}

/**
 * Options for configuring cache defaults through Hono `app.use(...)`.
 */
export interface CacheConfigOptions extends Omit<CacheDefaults, 'storage'> {
  /** Default storage instance used by cache middleware and cached functions. */
  storage?: Storage
}

export interface CacheMiddlewareOptions extends CacheBaseOptions {
  /**
   * Optional request-scoped defaults to apply before resolving this middleware options.
   * Useful for route-local overrides on top of `app.use(cacheDefaults(...))`.
   */
  config?: CacheConfigOptions
  /** Deserialize a cached entry back into a response. */
  deserialize?: (entry: CachedResponseEntry) => Response | Promise<Response>
  /** Provide a custom cache key. */
  getKey?: (ctx: Context) => string | Promise<string>
  /** Allowed HTTP methods (default: GET, HEAD). */
  methods?: string[]
  /** Serialize the response into a cached entry. */
  serialize?: (
    response: Response,
    context: { integrity: string; maxAge: number; staleMaxAge: number; now: number }
  ) => CachedResponseEntry | Promise<CachedResponseEntry>
  /** Return true to bypass cache entirely for this request. */
  shouldBypassCache?: (ctx: Context) => boolean | Promise<boolean>
  /** Return true to invalidate the cache before re-fetch. */
  shouldInvalidateCache?: (ctx: Context) => boolean | Promise<boolean>
  /** Return true to allow a manual revalidation request. */
  shouldRevalidate?: (ctx: Context) => boolean | Promise<boolean>
  /** Optional validation for cached response entries. */
  validate?: (entry: CachedResponseEntry) => boolean
  /** Request headers to include in the cache key. */
  varies?: string[]
}

export interface CacheFunctionOptions<TArgs extends unknown[]> extends CacheBaseOptions {
  /** Deserialize a cached entry back into the function result. */
  deserialize?: (entry: CachedFunctionEntry<unknown>) => unknown
  /** Provide a custom cache key. */
  getKey?: CacheKeyFn<TArgs>
  /** Serialize the function result into a cached entry. */
  serialize?: (
    value: unknown,
    context: { integrity: string; maxAge: number; staleMaxAge: number; now: number }
  ) => CachedFunctionEntry<unknown> | Promise<CachedFunctionEntry<unknown>>
  /** Return true to bypass cache entirely for this call. */
  shouldBypassCache?: (...args: TArgs) => boolean | Promise<boolean>
  /** Return true to invalidate the cache before re-fetch. */
  shouldInvalidateCache?: (...args: TArgs) => boolean | Promise<boolean>
  /** Optional validation for cached function entries. */
  validate?: (entry: CachedFunctionEntry<unknown>, ...args: TArgs) => boolean
}

export interface CachedResponseEntry {
  encoding: 'base64'
  /** Expiry timestamp (ms). */
  expires: number
  /** Response headers. */
  headers: Record<string, string>
  /** Integrity value. */
  integrity: string
  /** Last updated timestamp (ms). */
  mtime: number
  /** Stale expiry timestamp (ms) or null for unlimited stale. */
  staleExpires: number | null
  /** Response status code. */
  status: number
  /** Base64 encoded response body. */
  value: string
}

export interface CachedFunctionEntry<TResult> {
  /** Expiry timestamp (ms). */
  expires: number
  /** Integrity value. */
  integrity: string
  /** Last updated timestamp (ms). */
  mtime: number
  /** Stale expiry timestamp (ms) or null for unlimited stale. */
  staleExpires: number | null
  /** Cached value. */
  value: TResult
}
