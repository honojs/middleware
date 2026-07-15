import type { Context, MiddlewareHandler, Next } from 'hono'
import { getRuntimeKey } from 'hono/adapter'
import { decodeBase64, encodeBase64 } from 'hono/utils/encode'
import { LRUCache } from 'lru-cache'
import { hash as ohash } from 'ohash'
import { createStorage } from 'unstorage'
import type { Driver, Storage } from 'unstorage'
import type {
  CacheDefaults,
  CachedFunctionEntry,
  CachedResponseEntry,
  CacheFunctionOptions,
  CacheMiddlewareOptions,
  CacheStorageOptions,
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
  'proxy-connection',
])

const CACHE_MISS = Symbol('cache-miss')
const DEFAULT_MEMORY_MAX_ENTRIES = 1000
const DEFAULT_MEMORY_MAX_SIZE = 50 * 1024 * 1024
const DEFAULT_MEMORY_MAX_ENTRY_SIZE = 5 * 1024 * 1024
const DEFAULT_MAX_RESPONSE_BODY_SIZE = 3 * 1024 * 1024
const DEFAULT_MAX_RESPONSE_BODY_TIME = 1000
const DEFAULT_PENDING_REQUEST_TIME = 5000
const CONDITIONAL_REQUEST_HEADERS = [
  'range',
  'if-range',
  'if-match',
  'if-none-match',
  'if-modified-since',
  'if-unmodified-since',
] as const
const STREAMING_CONTENT_TYPES = [
  'text/event-stream',
  'application/x-ndjson',
  'application/ndjson',
  'application/json-seq',
  'application/stream+json',
  'multipart/x-mixed-replace',
]

const createMemoryDriver = (options: CacheStorageOptions = {}): Driver => {
  const cache = new LRUCache<string, string>({
    max: options.maxEntries ?? DEFAULT_MEMORY_MAX_ENTRIES,
    maxSize: options.maxSize ?? DEFAULT_MEMORY_MAX_SIZE,
    maxEntrySize: options.maxEntrySize ?? DEFAULT_MEMORY_MAX_ENTRY_SIZE,
    sizeCalculation: (value) => new TextEncoder().encode(value).byteLength,
  })
  return {
    name: 'hono-universal-cache-memory',
    flags: { ttl: true },
    getInstance: () => cache,
    hasItem: (key) => cache.has(key),
    getItem: (key) => cache.get(key) ?? null,
    setItem: (key, value, options) => {
      const ttl = options['ttl'] as number | undefined
      cache.set(key, value, ttl ? { ttl: ttl * 1000 } : undefined)
    },
    removeItem: (key) => {
      cache.delete(key)
    },
    getKeys: () => [...cache.keys()],
    clear: () => {
      cache.clear()
    },
    dispose: () => {
      cache.clear()
    },
  }
}

let defaultStorage: Storage = createStorage({
  driver: createMemoryDriver(),
})

let defaultCacheOptions: CacheDefaults = {}
const requestCacheDefaults = new WeakMap<Context, CacheDefaults>()

type PendingRequests = WeakMap<Storage, Map<string, Promise<unknown>>>

const pendingMiddlewareRequests: PendingRequests = new WeakMap()
const pendingFunctionRequests: PendingRequests = new WeakMap()
const functionNamespace = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
let functionNamespaceIndex = 0

const getPendingRequests = (pendingRequests: PendingRequests, storage: Storage) => {
  let requests = pendingRequests.get(storage)
  if (!requests) {
    requests = new Map()
    pendingRequests.set(storage, requests)
  }
  return requests
}

const readCacheEntry = async (storage: Storage, key: string) => {
  try {
    return await storage.getItem(key)
  } catch {
    return null
  }
}

const removeCacheEntry = async (storage: Storage, key: string) => {
  try {
    await storage.removeItem(key)
  } catch {
    // Cache failures must not fail the request.
  }
}

const setRequestCacheDefaults = (ctx: Context, options: CacheDefaults = {}) => {
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
 * Replace the global defaults applied to middleware and cached functions.
 * Pass an empty object to reset them.
 */
export const setCacheDefaults = (options: CacheDefaults): void => {
  defaultCacheOptions = { ...options }
}

/**
 * Get the global cache defaults applied to middleware and cached functions.
 */
export const getCacheDefaults = (): CacheDefaults => ({ ...defaultCacheOptions })

/**
 * Configure request-scoped cache defaults through Hono `app.use(...)`.
 * This allows global defaults and per-prefix overrides.
 */
export const cacheDefaults = (options: CacheDefaults = {}): MiddlewareHandler => {
  return async (ctx, next) => {
    setRequestCacheDefaults(ctx, options)
    await next()
  }
}

/**
 * Create a new in-memory storage instance.
 */
export const createCacheStorage = (options: CacheStorageOptions = {}): Storage =>
  createStorage({
    driver: createMemoryDriver(options),
  })

const createStorageKey = (base: string, group: string, name: string, key: string) => {
  const segments = [base, group, name, key].filter(Boolean)
  return `${segments.map((segment) => encodeURIComponent(segment)).join(':')}.json`
}

const escapeKey = (value: string) => value.replace(/\W/g, '')

const getDefaultHandlerKey = async (
  ctx: Context,
  varies: string[] | undefined,
  hashFn: (value: string) => string | Promise<string>
) => {
  const url = new URL(ctx.req.url)
  const method = ctx.req.method.toUpperCase()
  const body =
    method === 'GET' || method === 'HEAD'
      ? ''
      : `:${encodeBase64(await ctx.req.raw.clone().arrayBuffer())}`
  const fullPath = `${method}:${url.origin}${url.pathname}${url.search}${body}`

  let pathPrefix = '-'
  try {
    pathPrefix = escapeKey(decodeURI(url.pathname)).slice(0, 16) || 'index'
  } catch {
    pathPrefix = '-'
  }

  const hashedPath = `${pathPrefix}.${await hashFn(fullPath)}`
  const varyHeaders = [...new Set(varies?.map(toLower) ?? [])].sort()

  if (varyHeaders.length === 0) {
    return hashedPath
  }

  const varyParts = await Promise.all(
    varyHeaders.map(async (header) => {
      const value = ctx.req.header(header) ?? ''
      return `${encodeURIComponent(header)}.${await hashFn(value)}`
    })
  )
  const varyKey = varyParts.join(':')

  return `${hashedPath}:${varyKey}`
}

const getDefaultHandlerName = (ctx: Context) => {
  const url = new URL(ctx.req.url)
  return normalizePathToName(url.pathname)
}

const sanitizeResponseHeaders = (source: HeadersInit) => {
  const headers = new Headers(source)
  const connectionHeaders = headers
    .get('connection')
    ?.split(',')
    .map((header) => header.trim().toLowerCase())
    .filter(Boolean)
  for (const header of connectionHeaders ?? []) {
    headers.delete(header)
  }
  for (const header of HOP_BY_HOP_HEADERS) {
    headers.delete(header)
  }
  headers.delete('set-cookie')
  return headers
}

const createCachedResponse = (entry: CachedResponseEntry) => {
  const headers = sanitizeResponseHeaders(entry.headers)
  const storedAge = Number.parseInt(headers.get('age') ?? '0', 10)
  const responseDate = Date.parse(headers.get('date') ?? '')
  const apparentAge = Number.isFinite(responseDate)
    ? Math.max(0, Math.floor((entry.mtime - responseDate) / 1000))
    : 0
  const residentAge = Math.max(0, Math.floor((Date.now() - entry.mtime) / 1000))
  headers.set(
    'age',
    String(
      Math.max(apparentAge, Math.max(0, Number.isFinite(storedAge) ? storedAge : 0)) + residentAge
    )
  )
  const body = entry.status === 204 || entry.status === 205 ? null : decodeBase64(entry.value)
  return new Response(body, {
    status: entry.status,
    headers,
  })
}

const getCacheHeaders = (response: Response): Record<string, string> => {
  const headers = sanitizeResponseHeaders(response.headers)
  const entries: Record<string, string> = {}
  headers.forEach((value, key) => {
    entries[key] = value
  })
  return entries
}

const isCacheableResponse = (response: Response, varies: string[] | undefined) => {
  if (response.status < 200 || response.status >= 300 || response.status === 206) {
    return false
  }
  if (response.headers.has('set-cookie')) {
    return false
  }
  const contentType = response.headers.get('content-type')?.toLowerCase()
  if (contentType && STREAMING_CONTENT_TYPES.some((type) => contentType.startsWith(type))) {
    return false
  }
  const responseVaries = response.headers
    .get('vary')
    ?.split(',')
    .map((header) => toLower(header.trim()))
    .filter(Boolean)
  if (responseVaries?.length) {
    const keyedHeaders = new Set(varies?.map(toLower) ?? [])
    if (
      responseVaries.includes('*') ||
      responseVaries.some((header) => !keyedHeaders.has(header))
    ) {
      return false
    }
  }
  const cacheControl = response.headers.get('cache-control')
  if (!cacheControl) {
    return true
  }
  const normalized = cacheControl.toLowerCase()
  return !(
    normalized.includes('no-store') ||
    normalized.includes('no-cache') ||
    normalized.includes('private')
  )
}

const defaultSerializeResponse = async (
  response: Response,
  context: { integrity: string; maxAge: number; staleMaxAge: number; now: number }
) => {
  const { integrity, maxAge, staleMaxAge, now } = context
  const buffer = await readResponseBody(response)
  const value = encodeBase64(buffer.buffer)
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

const defaultDeserializeResponse = (entry: CachedResponseEntry) => createCachedResponse(entry)

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const readResponseBody = async (response: Response) => {
  const body = response.clone().body
  if (!body) {
    return new Uint8Array()
  }

  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  let complete = false
  let timeout: ReturnType<typeof setTimeout> | undefined
  const timedOut = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new Error('Cache response body timed out'))
    }, DEFAULT_MAX_RESPONSE_BODY_TIME)
  })

  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), timedOut])
      if (done) {
        complete = true
        break
      }
      size += value.byteLength
      if (size > DEFAULT_MAX_RESPONSE_BODY_SIZE) {
        throw new Error('Cache response body is too large')
      }
      chunks.push(value)
    }
  } finally {
    if (timeout) {
      clearTimeout(timeout)
    }
    if (!complete) {
      void reader.cancel().catch(() => undefined)
    }
    reader.releaseLock()
  }

  const buffer = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    buffer.set(chunk, offset)
    offset += chunk.byteLength
  }
  return buffer
}

const hasValidCacheMetadata = (entry: Record<string, unknown>) =>
  typeof entry['integrity'] === 'string' &&
  typeof entry['mtime'] === 'number' &&
  Number.isFinite(entry['mtime']) &&
  typeof entry['expires'] === 'number' &&
  Number.isFinite(entry['expires']) &&
  (entry['staleExpires'] === null ||
    (typeof entry['staleExpires'] === 'number' && Number.isFinite(entry['staleExpires'])))

const isValidCachedResponseEntry = (entry: unknown): entry is CachedResponseEntry => {
  if (!isRecord(entry)) {
    return false
  }
  return (
    hasValidCacheMetadata(entry) &&
    entry['encoding'] === 'base64' &&
    typeof entry['value'] === 'string' &&
    typeof entry['status'] === 'number' &&
    Number.isInteger(entry['status']) &&
    entry['status'] >= 200 &&
    entry['status'] < 300 &&
    entry['status'] !== 206 &&
    isRecord(entry['headers']) &&
    Object.values(entry['headers']).every((value) => typeof value === 'string')
  )
}

const isValidCachedFunctionEntry = <TResult>(
  entry: unknown
): entry is CachedFunctionEntry<TResult> => {
  if (!isRecord(entry)) {
    return false
  }
  return hasValidCacheMetadata(entry) && 'value' in entry
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
  const integrity = options.integrity ?? (await hashFn(stableStringify([group, name])))
  return { name, key, storageKey, integrity }
}

const maybeServeCachedResponse = async (
  storage: Storage,
  storageKey: string,
  integrity: string,
  cachedRaw: unknown,
  deserialize: NonNullable<CacheMiddlewareOptions['deserialize']>,
  validate?: CacheMiddlewareOptions['validate']
): Promise<{ response: Response; stale: boolean } | null> => {
  const cached = isValidCachedResponseEntry(cachedRaw) ? cachedRaw : null
  if (!cached) {
    if (cachedRaw !== null) {
      await removeCacheEntry(storage, storageKey)
    }
    return null
  }
  if (cached.integrity !== integrity) {
    await removeCacheEntry(storage, storageKey)
    return null
  }
  if (validate && validate(cached) === false) {
    await removeCacheEntry(storage, storageKey)
    return null
  }

  if (!isExpired(cached.expires)) {
    return { response: await deserialize(cached), stale: false }
  }

  if (isStaleValid(cached.staleExpires)) {
    return { response: await deserialize(cached), stale: true }
  }

  await removeCacheEntry(storage, storageKey)
  return null
}

const shouldBypassMiddlewareCache = async (ctx: Context, options: CacheMiddlewareOptions) => {
  if (CONDITIONAL_REQUEST_HEADERS.some((header) => ctx.req.header(header) !== undefined)) {
    return true
  }

  const cacheControl = ctx.req.header('cache-control')?.toLowerCase()
  if (
    cacheControl
      ?.split(',')
      .some((directive) => ['no-cache', 'no-store', 'max-age=0'].includes(directive.trim())) ||
    ctx.req
      .header('pragma')
      ?.toLowerCase()
      .split(',')
      .some((directive) => directive.trim() === 'no-cache')
  ) {
    return true
  }

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

const shouldManualRevalidateMiddlewareCache = async (
  ctx: Context,
  options: CacheMiddlewareOptions
) => {
  if (!options.shouldRevalidate) {
    return false
  }
  return await options.shouldRevalidate(ctx)
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
  try {
    const rawEntry = await serialize(response, { integrity, maxAge, staleMaxAge, now })
    const ttl = computeTtlSeconds(maxAge, staleMaxAge)
    if (ttl === 0) {
      return
    }
    await storage.setItem(storageKey, rawEntry, ttl ? { ttl } : undefined)
  } catch {
    // Cache failures must not fail the response.
  }
}

const readCachedResponse = async (
  storage: Storage,
  storageKey: string,
  integrity: string,
  options: CacheMiddlewareOptions,
  deserialize: NonNullable<CacheMiddlewareOptions['deserialize']>
) => {
  const cachedRaw = await readCacheEntry(storage, storageKey)
  try {
    return await maybeServeCachedResponse(
      storage,
      storageKey,
      integrity,
      cachedRaw,
      deserialize,
      options.validate
    )
  } catch {
    await removeCacheEntry(storage, storageKey)
    return null
  }
}

const writeCachedResponse = (
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
  let cacheResponse: Response
  try {
    cacheResponse = response.clone()
  } catch {
    return Promise.resolve()
  }
  const cachePromise = cacheResponseEntry(
    cacheResponse,
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
  }
  return cachePromise
}

/**
 * Hono middleware that caches responses based on request data.
 * Provide `hash` in options to use WebCrypto or node:crypto for key hashing.
 */
export const cacheMiddleware = (
  options: CacheMiddlewareOptions | number = {}
): MiddlewareHandler => {
  const normalized: CacheMiddlewareOptions =
    typeof options === 'number'
      ? { maxAge: options }
      : {
          ...options,
          ...(options.methods ? { methods: [...options.methods] } : {}),
          ...(options.varies ? { varies: [...options.varies] } : {}),
        }

  const handler: MiddlewareHandler = async (ctx: Context, next: Next) => {
    const merged: CacheMiddlewareOptions = {
      ...defaultCacheOptions,
      ...getRequestCacheDefaults(ctx),
      ...normalized,
    }

    const maxAge = merged.maxAge ?? DEFAULT_MAX_AGE
    const staleMaxAge = merged.staleMaxAge ?? DEFAULT_STALE_MAX_AGE
    const keepPreviousOn5xx = merged.keepPreviousOn5xx ?? true
    const base = merged.base ?? DEFAULT_CACHE_BASE
    const group = merged.group ?? DEFAULT_HANDLER_GROUP
    const methods = merged.methods?.map((method) => method.toUpperCase()) ?? ['GET', 'HEAD']
    const hashFn = merged.hash ?? ((value: string) => ohash(value))
    const serialize = merged.serialize ?? defaultSerializeResponse
    const deserialize = merged.deserialize ?? defaultDeserializeResponse
    const revalidateHeader = merged.revalidateHeader ?? false

    // Resolve storage at request time
    const storage = merged.storage ?? defaultStorage

    if (!methods.includes(ctx.req.method.toUpperCase())) {
      return next()
    }

    if (maxAge <= 0) {
      return next()
    }

    const isManualRevalidateRequest =
      revalidateHeader !== false && ctx.req.header(revalidateHeader) === '1'

    if (!merged.getKey) {
      const keyedHeaders = new Set(merged.varies?.map(toLower) ?? [])
      if (
        (ctx.req.header('authorization') !== undefined && !keyedHeaders.has('authorization')) ||
        (ctx.req.header('cookie') !== undefined && !keyedHeaders.has('cookie'))
      ) {
        return next()
      }
    }

    const isRevalidateRequest =
      isManualRevalidateRequest && (await shouldManualRevalidateMiddlewareCache(ctx, merged))

    const bypass = await shouldBypassMiddlewareCache(ctx, merged)
    if (bypass) {
      return next()
    }

    const { storageKey, integrity } = await resolveHandlerCacheKey(ctx, merged, base, group, hashFn)
    const shouldInvalidate = await shouldInvalidateMiddlewareCache(ctx, merged)
    const requests = getPendingRequests(pendingMiddlewareRequests, storage)
    const pendingKey = stableStringify([storageKey, integrity])
    const shouldCoalesce = !isRevalidateRequest && !shouldInvalidate
    let staleResponse: Response | undefined

    const servePendingResponse = async (pending: Promise<Response | null>) => {
      const shared = await pending
      if (!shared) {
        await next()
        return true
      }
      const response = shared.clone()
      ctx.res = response
      return response
    }

    if (shouldCoalesce) {
      const pending = requests.get(pendingKey) as Promise<Response | null> | undefined
      if (pending) {
        const pendingResponse = await servePendingResponse(pending)
        return pendingResponse === true ? ctx.res : pendingResponse
      }
    }

    if (shouldCoalesce) {
      const cachedResult = await readCachedResponse(
        storage,
        storageKey,
        integrity,
        merged,
        deserialize
      )
      if (cachedResult && !cachedResult.stale) {
        ctx.res = cachedResult.response
        return cachedResult.response
      }
      staleResponse = cachedResult?.response
    }

    if (shouldCoalesce) {
      const pending = requests.get(pendingKey) as Promise<Response | null> | undefined
      if (pending) {
        const pendingResponse = await servePendingResponse(pending)
        return pendingResponse === true ? ctx.res : pendingResponse
      }
    }

    let resolvePending: ((response: Response | null) => void) | undefined
    let rejectPending: ((error: unknown) => void) | undefined
    let pendingPromise: Promise<Response | null> | undefined
    let pendingTimeout: ReturnType<typeof setTimeout> | undefined
    let sharedPendingResponse: Response | null = null

    const clearPending = () => {
      if (pendingTimeout) {
        clearTimeout(pendingTimeout)
        pendingTimeout = undefined
      }
      if (requests.get(pendingKey) === pendingPromise) {
        requests.delete(pendingKey)
      }
      if (sharedPendingResponse?.body) {
        setTimeout(() => {
          void sharedPendingResponse?.body?.cancel().catch(() => undefined)
        }, 0)
      }
      sharedPendingResponse = null
    }

    if (shouldCoalesce) {
      pendingPromise = new Promise<Response | null>((resolve, reject) => {
        resolvePending = resolve
        rejectPending = reject
      })
      requests.set(pendingKey, pendingPromise)
      pendingTimeout = setTimeout(() => {
        resolvePending?.(null)
        clearPending()
      }, DEFAULT_PENDING_REQUEST_TIME)
      void pendingPromise.catch(() => undefined)
    }

    const settlePending = (response: Response | null, completion?: Promise<unknown>) => {
      if (!pendingPromise || !resolvePending || requests.get(pendingKey) !== pendingPromise) {
        return
      }
      try {
        sharedPendingResponse = response?.clone() ?? null
      } catch {
        sharedPendingResponse = null
      }
      resolvePending(sharedPendingResponse)
      if (completion) {
        void completion.finally(clearPending)
      } else {
        void Promise.resolve().then(clearPending)
      }
    }

    const failPending = (error: unknown) => {
      if (pendingPromise && rejectPending) {
        rejectPending(error)
        clearPending()
      }
    }

    if (shouldInvalidate && !keepPreviousOn5xx) {
      await removeCacheEntry(storage, storageKey)
    }

    try {
      await next()
    } catch (error) {
      if (staleResponse) {
        settlePending(staleResponse)
        ctx.res = staleResponse
        return staleResponse
      }
      failPending(error)
      throw error
    }
    const response = ctx.res

    if (!response) {
      settlePending(null)
      return response
    }

    if (response.status >= 500 && staleResponse) {
      settlePending(staleResponse)
      ctx.res = staleResponse
      return staleResponse
    }

    if (!isCacheableResponse(response, merged.varies)) {
      if (shouldInvalidate && keepPreviousOn5xx && response.status < 500) {
        await removeCacheEntry(storage, storageKey)
      }
      settlePending(response.status >= 500 ? response : null)
      return response
    }

    const cacheWrite = writeCachedResponse(
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
    settlePending(response, cacheWrite)
    return response
  }

  return handler
}

const createFunctionEntry = <TResult>(
  result: TResult,
  integrity: string,
  maxAge: number,
  staleMaxAge: number,
  now: number
): CachedFunctionEntry<TResult> => {
  return {
    value: result,
    mtime: now,
    expires: now + maxAge * 1000,
    staleExpires: staleMaxAge < 0 ? null : now + (maxAge + Math.max(staleMaxAge, 0)) * 1000,
    integrity,
  }
}

const defaultSerializeFunctionEntry = <TResult>(
  result: TResult,
  context: { integrity: string; maxAge: number; staleMaxAge: number; now: number }
) =>
  createFunctionEntry(result, context.integrity, context.maxAge, context.staleMaxAge, context.now)

const defaultDeserializeFunctionEntry = <TResult>(entry: CachedFunctionEntry<TResult>) =>
  entry.value

const shouldBypassFunctionCache = async <TArgs extends unknown[], TResult, TStored>(
  options: CacheFunctionOptions<TArgs, TResult, TStored>,
  args: TArgs
) => {
  if (!options.shouldBypassCache) {
    return false
  }
  return await options.shouldBypassCache(...args)
}

const shouldInvalidateFunctionCache = async <TArgs extends unknown[], TResult, TStored>(
  options: CacheFunctionOptions<TArgs, TResult, TStored>,
  args: TArgs
) => {
  if (!options.shouldInvalidateCache) {
    return false
  }
  return await options.shouldInvalidateCache(...args)
}

const getFunctionStorageKey = async <TArgs extends unknown[], TResult, TStored>(
  options: CacheFunctionOptions<TArgs, TResult, TStored>,
  base: string,
  group: string,
  name: string,
  args: TArgs,
  hashFn: (value: string) => string | Promise<string>
) => {
  const key = options.getKey ? await options.getKey(...args) : await hashFn(stableStringify(args))
  return createStorageKey(base, group, name, key)
}

const refreshFunctionCache = async <TResult, TStored>(
  storage: Storage,
  storageKey: string,
  result: TResult,
  integrity: string,
  maxAge: number,
  staleMaxAge: number,
  now: number,
  serialize: NonNullable<CacheFunctionOptions<unknown[], TResult, TStored>['serialize']>
) => {
  try {
    const rawEntry = await serialize(result, { integrity, maxAge, staleMaxAge, now })
    const ttl = computeTtlSeconds(maxAge, staleMaxAge)
    await storage.setItem(storageKey, rawEntry, ttl ? { ttl } : undefined)
  } catch {
    // Cache failures must not fail the function result.
  }
  return result
}

const maybeServeCachedFunctionValue = async <TResult, TStored, TArgs extends unknown[]>(
  cached: CachedFunctionEntry<TStored> | null,
  storageKey: string,
  integrity: string,
  swr: boolean,
  fetcher: () => Promise<TResult> | TResult,
  storage: Storage,
  maxAge: number,
  staleMaxAge: number,
  serialize: NonNullable<CacheFunctionOptions<TArgs, TResult, TStored>['serialize']>,
  deserialize: NonNullable<CacheFunctionOptions<TArgs, TResult, TStored>['deserialize']>,
  pendingRequests: PendingRequests,
  validate?: CacheFunctionOptions<TArgs, TResult, TStored>['validate'],
  validateArgs?: TArgs
): Promise<TResult | typeof CACHE_MISS> => {
  if (!cached) {
    return CACHE_MISS
  }
  if (cached.integrity !== integrity) {
    await removeCacheEntry(storage, storageKey)
    return CACHE_MISS
  }
  if (validate) {
    const args = validateArgs ?? ([] as unknown as TArgs)
    if (validate(cached, ...args) === false) {
      await removeCacheEntry(storage, storageKey)
      return CACHE_MISS
    }
  }
  if (!isExpired(cached.expires)) {
    return (await deserialize(cached)) as TResult
  }
  if (swr && isStaleValid(cached.staleExpires)) {
    const requests = getPendingRequests(pendingRequests, storage)
    const pendingKey = stableStringify([storageKey, integrity])
    if (!requests.has(pendingKey)) {
      const refreshPromise = Promise.resolve().then(fetcher)
      requests.set(pendingKey, refreshPromise)
      const timeout = setTimeout(() => {
        if (requests.get(pendingKey) === refreshPromise) {
          requests.delete(pendingKey)
        }
      }, DEFAULT_PENDING_REQUEST_TIME)
      void refreshPromise
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
          clearTimeout(timeout)
          if (requests.get(pendingKey) === refreshPromise) {
            requests.delete(pendingKey)
          }
        })
        .catch(() => undefined)
    }
    return (await deserialize(cached)) as TResult
  }
  await removeCacheEntry(storage, storageKey)
  return CACHE_MISS
}

/**
 * Wrap a function with cache behavior.
 * Provide `hash` in options to use WebCrypto or node:crypto for key hashing.
 */
export const cacheFunction = <TArgs extends unknown[], TResult, TStored = TResult>(
  fn: (...args: TArgs) => Promise<TResult> | TResult,
  options: CacheFunctionOptions<TArgs, TResult, TStored> | number = {}
): ((...args: TArgs) => Promise<TResult>) => {
  const normalized: CacheFunctionOptions<TArgs, TResult, TStored> =
    typeof options === 'number' ? { maxAge: options } : { ...options }
  const implicitName = `${fn.name || '_'}:${functionNamespace}:${functionNamespaceIndex++}`

  return async (...args: TArgs): Promise<TResult> => {
    const merged: CacheFunctionOptions<TArgs, TResult, TStored> = {
      ...defaultCacheOptions,
      ...normalized,
    }
    const maxAge = merged.maxAge ?? DEFAULT_MAX_AGE
    const staleMaxAge = merged.staleMaxAge ?? DEFAULT_STALE_MAX_AGE
    const swr = merged.swr ?? true
    const keepPreviousOn5xx = merged.keepPreviousOn5xx ?? true
    const base = merged.base ?? DEFAULT_CACHE_BASE
    const name = merged.name ?? implicitName
    const group = merged.group ?? DEFAULT_FUNCTION_GROUP
    const hashFn = merged.hash ?? ((value: string) => ohash(value))
    const serialize = (merged.serialize ?? defaultSerializeFunctionEntry) as NonNullable<
      CacheFunctionOptions<TArgs, TResult, TStored>['serialize']
    >
    const deserialize = (merged.deserialize ?? defaultDeserializeFunctionEntry) as NonNullable<
      CacheFunctionOptions<TArgs, TResult, TStored>['deserialize']
    >
    const storage = merged.storage ?? defaultStorage

    if (maxAge <= 0) {
      return await fn(...args)
    }

    const bypass = await shouldBypassFunctionCache(merged, args)
    if (bypass) {
      return await fn(...args)
    }

    const integrity = merged.integrity ?? (await hashFn(fn.toString()))
    const storageKey = await getFunctionStorageKey(merged, base, group, name, args, hashFn)
    const shouldInvalidate = await shouldInvalidateFunctionCache(merged, args)

    const cachedRaw = shouldInvalidate ? null : await readCacheEntry(storage, storageKey)
    const cached = isValidCachedFunctionEntry<TStored>(cachedRaw) ? cachedRaw : null
    if (!cached && cachedRaw !== null) {
      await removeCacheEntry(storage, storageKey)
    }
    let cachedValue: TResult | typeof CACHE_MISS = CACHE_MISS
    try {
      cachedValue = await maybeServeCachedFunctionValue<TResult, TStored, TArgs>(
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
        pendingFunctionRequests,
        merged.validate,
        args
      )
    } catch {
      await removeCacheEntry(storage, storageKey)
    }
    if (cachedValue !== CACHE_MISS) {
      return cachedValue
    }

    if (shouldInvalidate && !keepPreviousOn5xx) {
      await removeCacheEntry(storage, storageKey)
    }

    const requests = getPendingRequests(pendingFunctionRequests, storage)
    const pendingKey = stableStringify([storageKey, integrity])
    if (requests.has(pendingKey)) {
      return (await requests.get(pendingKey)) as TResult
    }

    const resultPromise = Promise.resolve().then(() => fn(...args))
    requests.set(pendingKey, resultPromise)
    const timeout = setTimeout(() => {
      if (requests.get(pendingKey) === resultPromise) {
        requests.delete(pendingKey)
      }
    }, DEFAULT_PENDING_REQUEST_TIME)
    void resultPromise
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
        clearTimeout(timeout)
        if (requests.get(pendingKey) === resultPromise) {
          requests.delete(pendingKey)
        }
      })
      .catch(() => undefined)
    return await resultPromise
  }
}
