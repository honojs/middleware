import type { Context, MiddlewareHandler, Next } from 'hono'
import { getRuntimeKey } from 'hono/adapter'
import { hash as ohash } from 'ohash'
import { createStorage, type Storage } from 'unstorage'
import memoryDriver from 'unstorage/drivers/memory'
import type {
  CacheConfigOptions,
  CacheDefaults,
  CachedFunctionEntry,
  CachedResponseEntry,
  CacheFunctionOptions,
  CacheMiddlewareOptions,
} from './types'
import {
  computeTtlSeconds,
  DEFAULT_CACHE_BASE,
  DEFAULT_FUNCTION_GROUP,
  DEFAULT_HANDLER_GROUP,
  DEFAULT_MAX_AGE,
  DEFAULT_STALE_MAX_AGE,
  isExpired,
  isStaleValid,
  normalizePathToName,
  stableStringify,
  toLower,
} from './utils'

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'content-length',
])

const DEFAULT_REVALIDATE_HEADER = 'x-cache-revalidate'

let defaultStorage: Storage = createStorage({
  driver: memoryDriver(),
})

let defaultCacheOptions: CacheDefaults = {}
const requestCacheDefaults = new WeakMap<Context, CacheDefaults>()

const pendingFunctionRequests = new Map<string, Promise<unknown>>()
const pendingRevalidations = new Map<string, Promise<void>>()

const setRequestCacheDefaults = (ctx: Context, options: CacheConfigOptions = {}) => {
  const current = requestCacheDefaults.get(ctx) ?? {}
  requestCacheDefaults.set(ctx, {
    ...current,
    ...options,
  })
}

const getRequestCacheDefaults = (ctx: Context): CacheDefaults => requestCacheDefaults.get(ctx) ?? {}

/**
 * Set the default storage instance used by cache middleware and functions.
 */
export const setCacheStorage = (storage: Storage): void => {
  defaultStorage = storage
}

/**
 * Get the default storage instance used by cache middleware and functions.
 */
export const getCacheStorage = (): Storage => defaultStorage

/**
 * Set global cache defaults applied to middleware and cached functions.
 */
export const setCacheDefaults = (options: CacheDefaults): void => {
  defaultCacheOptions = {
    ...defaultCacheOptions,
    ...options,
  }
}

/**
 * Get the global cache defaults applied to middleware and cached functions.
 */
export const getCacheDefaults = (): CacheDefaults => defaultCacheOptions

/**
 * Configure request-scoped cache defaults through Hono `app.use(...)`.
 * This allows global defaults and per-prefix overrides.
 */
export const cacheDefaults = (options: CacheConfigOptions = {}): MiddlewareHandler => {
  return async (ctx, next) => {
    setRequestCacheDefaults(ctx, options)
    await next()
  }
}

/**
 * @deprecated Use cacheDefaults(options) instead.
 */
export const cacheConfig = (options: CacheConfigOptions = {}): MiddlewareHandler =>
  cacheDefaults(options)

/**
 * Create a new in-memory storage instance.
 */
export const createCacheStorage = (): Storage =>
  createStorage({
    driver: memoryDriver(),
  })

const createStorageKey = (base: string, group: string, name: string, key: string) => {
  const segments = [base, group, name, key].filter(Boolean)
  return `${segments.join(':')}.json`
}

const escapeKey = (value: string) => value.replace(/\W/g, '')

const getDefaultHandlerKey = async (
  ctx: Context,
  varies: string[] | undefined,
  hashFn: (value: string) => string | Promise<string>
) => {
  const url = new URL(ctx.req.url)
  const fullPath = `${url.pathname}${url.search}`

  let pathPrefix = '-'
  try {
    pathPrefix = escapeKey(decodeURI(url.pathname)).slice(0, 16) || 'index'
  } catch {
    pathPrefix = '-'
  }

  const hashedPath = `${pathPrefix}.${await hashFn(fullPath)}`
  if (!varies?.length) {
    return hashedPath
  }

  const varyParts = await Promise.all(
    varies.map(async (header) => {
      const value = ctx.req.header(header) ?? ''
      return `${escapeKey(toLower(header))}.${await hashFn(value)}`
    })
  )
  const varyKey = varyParts.join(':')

  return `${hashedPath}:${varyKey}`
}

const getDefaultHandlerName = (ctx: Context) => {
  const url = new URL(ctx.req.url)
  return normalizePathToName(url.pathname)
}

const createCachedResponse = (entry: CachedResponseEntry) => {
  const headers = new Headers(entry.headers)
  return new Response(base64ToUint8Array(entry.value), {
    status: entry.status,
    headers,
  })
}

const getCacheHeaders = (response: Response): Record<string, string> => {
  const headers = new Headers(response.headers)
  for (const header of HOP_BY_HOP_HEADERS) {
    headers.delete(header)
  }
  headers.delete('set-cookie')
  const entries: Record<string, string> = {}
  headers.forEach((value, key) => {
    entries[key] = value
  })
  return entries
}

const isCacheableResponse = (response: Response) => {
  if (response.status < 200 || response.status >= 300) {
    return false
  }
  if (response.headers.has('set-cookie')) {
    return false
  }
  const etag = response.headers.get('etag')
  if (etag === 'undefined') {
    return false
  }
  const lastModified = response.headers.get('last-modified')
  if (lastModified === 'undefined') {
    return false
  }
  const cacheControl = response.headers.get('cache-control')
  if (!cacheControl) {
    return true
  }
  const normalized = cacheControl.toLowerCase()
  return !(normalized.includes('no-store') || normalized.includes('no-cache'))
}

const defaultSerializeResponse = async (
  response: Response,
  context: { integrity: string; maxAge: number; staleMaxAge: number; now: number }
) => {
  const { integrity, maxAge, staleMaxAge, now } = context
  const buffer = await response.clone().arrayBuffer()
  const value = arrayBufferToBase64(buffer)
  const expires = now + maxAge * 1000
  const staleExpires = staleMaxAge < 0 ? null : now + (maxAge + Math.max(staleMaxAge, 0)) * 1000

  return {
    value,
    encoding: 'base64',
    status: response.status,
    headers: getCacheHeaders(response),
    mtime: now,
    expires,
    staleExpires,
    integrity,
  } satisfies CachedResponseEntry
}

const defaultDeserializeResponse = async (entry: CachedResponseEntry) => createCachedResponse(entry)

interface BufferLike {
  from: (
    input: Uint8Array | ArrayBuffer | string,
    encoding?: string
  ) => Uint8Array & {
    toString: (encoding: string) => string
  }
}

const getBufferCtor = (): BufferLike | null => {
  const bufferCtor = (globalThis as unknown as { Buffer?: unknown }).Buffer
  if (typeof bufferCtor === 'function' && 'from' in (bufferCtor as object)) {
    return bufferCtor as unknown as BufferLike
  }
  return null
}

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer)
  if (typeof globalThis.btoa === 'function') {
    let binary = ''
    const chunkSize = 0x80_00
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize)
      binary += String.fromCharCode(...chunk)
    }
    return globalThis.btoa(binary)
  }
  const bufferCtor = getBufferCtor()
  if (bufferCtor) {
    return bufferCtor.from(bytes).toString('base64')
  }
  throw new Error('Base64 encoding is not available in this runtime')
}

const base64ToUint8Array = (base64: string) => {
  if (typeof globalThis.atob === 'function') {
    const binary = globalThis.atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes
  }
  const bufferCtor = getBufferCtor()
  if (bufferCtor) {
    const buffer = bufferCtor.from(base64, 'base64')
    return new Uint8Array(buffer)
  }
  throw new Error('Base64 decoding is not available in this runtime')
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isValidCachedResponseEntry = (entry: unknown): entry is CachedResponseEntry => {
  if (!isRecord(entry)) {
    return false
  }
  if (typeof entry['value'] !== 'string') {
    return false
  }
  if (typeof entry['status'] !== 'number') {
    return false
  }
  if (!isRecord(entry['headers'])) {
    return false
  }
  const headers = entry['headers']
  if (headers['etag'] === 'undefined') {
    return false
  }
  if (headers['last-modified'] === 'undefined') {
    return false
  }
  return true
}

const isValidCachedFunctionEntry = <TResult>(
  entry: unknown
): entry is CachedFunctionEntry<TResult> => {
  if (!isRecord(entry)) {
    return false
  }
  return 'value' in entry
}

const resolveHandlerCacheKey = async (
  ctx: Context,
  options: CacheMiddlewareOptions,
  base: string,
  group: string,
  hashFn: (value: string) => string | Promise<string>
) => {
  const name = options.name ?? getDefaultHandlerName(ctx)
  const key = options.getKey
    ? await options.getKey(ctx)
    : await getDefaultHandlerKey(ctx, options.varies, hashFn)
  const storageKey = createStorageKey(base, group, name, key)
  const integrity = options.integrity ?? (await hashFn(`${group}:${name}`))
  return { name, key, storageKey, integrity }
}

const maybeServeCachedResponse = async (
  ctx: Context,
  storage: Storage,
  storageKey: string,
  integrity: string,
  swr: boolean,
  cachedRaw: unknown,
  deserialize: NonNullable<CacheMiddlewareOptions['deserialize']>,
  revalidateHeader: string,
  validate?: CacheMiddlewareOptions['validate']
) => {
  const cached = isValidCachedResponseEntry(cachedRaw) ? cachedRaw : null
  if (!cached) {
    if (cachedRaw !== null) {
      await storage.removeItem(storageKey)
    }
    return null
  }
  if (cached.integrity !== integrity) {
    await storage.removeItem(storageKey)
    return null
  }
  if (validate && validate(cached) === false) {
    await storage.removeItem(storageKey)
    return null
  }

  if (!isExpired(cached.expires)) {
    return await deserialize(cached)
  }

  if (swr && isStaleValid(cached.staleExpires)) {
    if (!pendingRevalidations.has(storageKey)) {
      const revalidatePromise = (async () => {
        try {
          const refreshHeaders = new Headers(ctx.req.raw.headers)
          refreshHeaders.set(revalidateHeader, '1')
          const request = new Request(ctx.req.url, {
            method: ctx.req.method,
            headers: refreshHeaders,
          })
          await fetch(request)
        } finally {
          pendingRevalidations.delete(storageKey)
        }
      })()
      pendingRevalidations.set(storageKey, revalidatePromise)
    }
    return await deserialize(cached)
  }

  return null
}

const shouldBypassMiddlewareCache = async (ctx: Context, options: CacheMiddlewareOptions) => {
  if (!options.shouldBypassCache) {
    return false
  }
  return await options.shouldBypassCache(ctx)
}

const shouldInvalidateMiddlewareCache = async (ctx: Context, options: CacheMiddlewareOptions) => {
  if (!options.shouldInvalidateCache) {
    return false
  }
  return await options.shouldInvalidateCache(ctx)
}

const cacheResponseEntry = async (
  response: Response,
  storage: Storage,
  storageKey: string,
  integrity: string,
  maxAge: number,
  staleMaxAge: number,
  now: number,
  serialize: NonNullable<CacheMiddlewareOptions['serialize']>
) => {
  const rawEntry = await serialize(response, { integrity, maxAge, staleMaxAge, now })
  const ttl = computeTtlSeconds(maxAge, staleMaxAge)
  if (ttl === 0) {
    return
  }
  await storage.setItem(storageKey, rawEntry, ttl ? { ttl } : undefined)
}

const readCachedResponse = async (
  ctx: Context,
  storage: Storage,
  storageKey: string,
  integrity: string,
  options: CacheMiddlewareOptions,
  swr: boolean,
  deserialize: NonNullable<CacheMiddlewareOptions['deserialize']>,
  revalidateHeader: string
) => {
  const cachedRaw = await storage.getItem(storageKey)
  return await maybeServeCachedResponse(
    ctx,
    storage,
    storageKey,
    integrity,
    swr,
    cachedRaw,
    deserialize,
    revalidateHeader,
    options.validate
  )
}

const writeCachedResponse = async (
  ctx: Context,
  storage: Storage,
  storageKey: string,
  integrity: string,
  response: Response,
  maxAge: number,
  staleMaxAge: number,
  now: number,
  serialize: NonNullable<CacheMiddlewareOptions['serialize']>
) => {
  const cachePromise = cacheResponseEntry(
    response,
    storage,
    storageKey,
    integrity,
    maxAge,
    staleMaxAge,
    now,
    serialize
  )

  if (getRuntimeKey() === 'workerd') {
    ctx.executionCtx?.waitUntil?.(cachePromise)
    return
  }

  await cachePromise
}

/**
 * Hono middleware that caches responses based on request data.
 * Provide `hash` in options to use WebCrypto or node:crypto for key hashing.
 */
export const cacheMiddleware = (
  options: CacheMiddlewareOptions | number = {}
): MiddlewareHandler => {
  const normalized: CacheMiddlewareOptions =
    typeof options === 'number' ? { maxAge: options } : options
  const { config: middlewareConfig, ...routeOptions } = normalized
  const isConfigOnly = middlewareConfig !== undefined && Object.keys(routeOptions).length === 0

  const handler: MiddlewareHandler = async (ctx: Context, next: Next) => {
    if (middlewareConfig) {
      setRequestCacheDefaults(ctx, middlewareConfig)
    }

    if (isConfigOnly) {
      return next()
    }

    const merged: CacheMiddlewareOptions = {
      ...defaultCacheOptions,
      ...getRequestCacheDefaults(ctx),
      ...routeOptions,
    }

    const maxAge = merged.maxAge ?? DEFAULT_MAX_AGE
    const staleMaxAge = merged.staleMaxAge ?? DEFAULT_STALE_MAX_AGE
    const swr = merged.swr ?? true
    const keepPreviousOn5xx = merged.keepPreviousOn5xx ?? true
    const base = merged.base ?? DEFAULT_CACHE_BASE
    const group = merged.group ?? DEFAULT_HANDLER_GROUP
    const methods = merged.methods?.map((method) => method.toUpperCase()) ?? ['GET', 'HEAD']
    const hashFn = merged.hash ?? ((value: string) => ohash(value))
    const serialize = merged.serialize ?? defaultSerializeResponse
    const deserialize = merged.deserialize ?? defaultDeserializeResponse
    const revalidateHeader = merged.revalidateHeader ?? DEFAULT_REVALIDATE_HEADER

    // Resolve storage at request time
    const storage = merged.storage ?? defaultStorage

    if (!methods.includes(ctx.req.method.toUpperCase())) {
      return next()
    }

    if (maxAge <= 0) {
      return next()
    }

    const bypass = await shouldBypassMiddlewareCache(ctx, merged)
    if (bypass) {
      return next()
    }

    const isRevalidateRequest = ctx.req.header(revalidateHeader) === '1'
    const { storageKey, integrity } = await resolveHandlerCacheKey(ctx, merged, base, group, hashFn)

    if (!isRevalidateRequest) {
      const cachedResponse = await readCachedResponse(
        ctx,
        storage,
        storageKey,
        integrity,
        merged,
        swr,
        deserialize,
        revalidateHeader
      )
      if (cachedResponse) {
        ctx.res = cachedResponse
        return cachedResponse
      }
    }

    const shouldInvalidate = await shouldInvalidateMiddlewareCache(ctx, merged)
    if (shouldInvalidate && !keepPreviousOn5xx) {
      await storage.removeItem(storageKey)
    }

    await next()
    const response = ctx.res

    if (!response) {
      return response
    }

    if (!isCacheableResponse(response)) {
      if (shouldInvalidate && keepPreviousOn5xx && response.status < 500) {
        await storage.removeItem(storageKey)
      }
      return response
    }

    await writeCachedResponse(
      ctx,
      storage,
      storageKey,
      integrity,
      response,
      maxAge,
      staleMaxAge,
      Date.now(),
      serialize
    )
    return response
  }

  return handler
}

const createFunctionEntry = (
  result: unknown,
  integrity: string,
  maxAge: number,
  staleMaxAge: number,
  now: number
): CachedFunctionEntry<unknown> => {
  return {
    value: result,
    mtime: now,
    expires: now + maxAge * 1000,
    staleExpires: staleMaxAge < 0 ? null : now + (maxAge + Math.max(staleMaxAge, 0)) * 1000,
    integrity,
  }
}

const defaultSerializeFunctionEntry = (
  result: unknown,
  context: { integrity: string; maxAge: number; staleMaxAge: number; now: number }
) =>
  createFunctionEntry(result, context.integrity, context.maxAge, context.staleMaxAge, context.now)

const defaultDeserializeFunctionEntry = async <TResult>(entry: CachedFunctionEntry<TResult>) =>
  entry.value

const shouldBypassFunctionCache = async <TArgs extends unknown[]>(
  options: CacheFunctionOptions<TArgs>,
  args: TArgs
) => {
  if (!options.shouldBypassCache) {
    return false
  }
  return await options.shouldBypassCache(...args)
}

const shouldInvalidateFunctionCache = async <TArgs extends unknown[]>(
  options: CacheFunctionOptions<TArgs>,
  args: TArgs
) => {
  if (!options.shouldInvalidateCache) {
    return false
  }
  return await options.shouldInvalidateCache(...args)
}

const getFunctionStorageKey = async <TArgs extends unknown[]>(
  options: CacheFunctionOptions<TArgs>,
  base: string,
  group: string,
  name: string,
  args: TArgs,
  hashFn: (value: string) => string | Promise<string>
) => {
  const key = options.getKey ? await options.getKey(...args) : await hashFn(stableStringify(args))
  return createStorageKey(base, group, name, key)
}

const refreshFunctionCache = async <TResult>(
  storage: Storage,
  storageKey: string,
  result: TResult,
  integrity: string,
  maxAge: number,
  staleMaxAge: number,
  now: number,
  serialize: NonNullable<CacheFunctionOptions<unknown[]>['serialize']>
) => {
  const rawEntry = await serialize(result, { integrity, maxAge, staleMaxAge, now })
  const ttl = computeTtlSeconds(maxAge, staleMaxAge)
  await storage.setItem(storageKey, rawEntry, ttl ? { ttl } : undefined)
  return result
}

const maybeServeCachedFunctionValue = async <TResult, TArgs extends unknown[]>(
  cached: CachedFunctionEntry<TResult> | null,
  storageKey: string,
  integrity: string,
  swr: boolean,
  fetcher: () => Promise<TResult> | TResult,
  storage: Storage,
  maxAge: number,
  staleMaxAge: number,
  serialize: NonNullable<CacheFunctionOptions<TArgs>['serialize']>,
  deserialize: NonNullable<CacheFunctionOptions<TArgs>['deserialize']>,
  validate?: CacheFunctionOptions<TArgs>['validate'],
  validateArgs?: TArgs
): Promise<TResult | null> => {
  if (!cached || cached.integrity !== integrity) {
    return null
  }
  if (validate) {
    const args = validateArgs ?? ([] as unknown as TArgs)
    if (validate(cached, ...args) === false) {
      return null
    }
  }
  if (!isExpired(cached.expires)) {
    return (await deserialize(cached)) as TResult
  }
  if (swr && isStaleValid(cached.staleExpires)) {
    if (!pendingFunctionRequests.has(storageKey)) {
      const refreshPromise = Promise.resolve(fetcher())
        .then((fresh) =>
          refreshFunctionCache(
            storage,
            storageKey,
            fresh,
            integrity,
            maxAge,
            staleMaxAge,
            Date.now(),
            serialize
          )
        )
        .finally(() => {
          pendingFunctionRequests.delete(storageKey)
        })
      pendingFunctionRequests.set(storageKey, refreshPromise)
    }
    return (await deserialize(cached)) as TResult
  }
  return null
}

/**
 * Wrap a function with cache behavior.
 * Provide `hash` in options to use WebCrypto or node:crypto for key hashing.
 */
export const cacheFunction = <TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult> | TResult,
  options: CacheFunctionOptions<TArgs> | number = {}
): ((...args: TArgs) => Promise<TResult>) => {
  const normalized = typeof options === 'number' ? { maxAge: options } : options
  const merged = { ...defaultCacheOptions, ...normalized }
  const maxAge = merged.maxAge ?? DEFAULT_MAX_AGE
  const staleMaxAge = merged.staleMaxAge ?? DEFAULT_STALE_MAX_AGE
  const swr = merged.swr ?? true
  const keepPreviousOn5xx = merged.keepPreviousOn5xx ?? true
  const base = merged.base ?? DEFAULT_CACHE_BASE
  const name = (merged.name ?? fn.name) || '_'
  const group = merged.group ?? DEFAULT_FUNCTION_GROUP
  const hashFn = merged.hash ?? ((value: string) => ohash(value))
  const serialize = merged.serialize ?? defaultSerializeFunctionEntry
  const deserialize = merged.deserialize ?? defaultDeserializeFunctionEntry
  const integrityValue = merged.integrity
  let integrityCache: string | null = null
  let integrityPromise: Promise<string> | null = null

  const getFunctionIntegrity = async () => {
    if (integrityCache) {
      return integrityCache
    }
    if (!integrityPromise) {
      integrityPromise = (async () => {
        const integrity = integrityValue ?? (await hashFn(fn.toString()))
        integrityCache = integrity
        return integrity
      })()
    }
    return await integrityPromise
  }

  return async (...args: TArgs): Promise<TResult> => {
    // Resolve storage at call time, not function creation time
    const storage = merged.storage ?? defaultStorage

    if (maxAge <= 0) {
      return await fn(...args)
    }

    const bypass = await shouldBypassFunctionCache(merged, args)
    if (bypass) {
      return await fn(...args)
    }

    const integrity = await getFunctionIntegrity()
    const storageKey = await getFunctionStorageKey(merged, base, group, name, args, hashFn)

    const cachedRaw = await storage.getItem(storageKey)
    const cached = isValidCachedFunctionEntry<TResult>(cachedRaw) ? cachedRaw : null
    if (!cached && cachedRaw !== null) {
      await storage.removeItem(storageKey)
    }
    const cachedValue = await maybeServeCachedFunctionValue<TResult, TArgs>(
      cached,
      storageKey,
      integrity,
      swr,
      () => fn(...args),
      storage,
      maxAge,
      staleMaxAge,
      serialize,
      deserialize,
      merged.validate,
      args
    )
    if (cachedValue !== null) {
      return cachedValue
    }

    const shouldInvalidate = await shouldInvalidateFunctionCache(merged, args)
    if (shouldInvalidate && !keepPreviousOn5xx) {
      await storage.removeItem(storageKey)
    }

    if (pendingFunctionRequests.has(storageKey)) {
      return (await pendingFunctionRequests.get(storageKey)) as TResult
    }

    const resultPromise = Promise.resolve(fn(...args))
      .then((result) =>
        refreshFunctionCache(
          storage,
          storageKey,
          result,
          integrity,
          maxAge,
          staleMaxAge,
          Date.now(),
          serialize
        )
      )
      .finally(() => {
        pendingFunctionRequests.delete(storageKey)
      })

    pendingFunctionRequests.set(storageKey, resultPromise)
    return await resultPromise
  }
}
