import { serialize as serializeHashValue } from 'ohash'

/** Default storage base prefix. */
export const DEFAULT_CACHE_BASE = 'cache'
/** Default storage group for cached handlers. */
export const DEFAULT_HANDLER_GROUP = 'hono/handlers'
/** Default storage group for cached functions. */
export const DEFAULT_FUNCTION_GROUP = 'hono/functions'
/** Default cache max age in seconds. */
export const DEFAULT_MAX_AGE = 60
/** Default stale max age in seconds. */
export const DEFAULT_STALE_MAX_AGE = 0

/** Normalize a string to lower-case. */
export const toLower = (value: string): string => value.toLowerCase()

/** Normalize a URL path into a cache-friendly name. */
export const normalizePathToName = (path: string): string => {
  const trimmed = path.replace(/(^\/|\/$)/g, '')
  if (!trimmed) {
    return 'root'
  }
  return trimmed.replace(/\/+?/g, ':')
}

/** Stable, type-aware serialization for cache keys. */
export const stableStringify = (value: unknown): string => {
  const references = new WeakMap<object, number>()
  let referenceIndex = 0

  const serialize = (current: unknown): string => {
    if (Object.is(current, -0)) {
      return 'number:-0'
    }

    const isPlainObject =
      typeof current === 'object' &&
      current !== null &&
      (Object.getPrototypeOf(current) === Object.prototype ||
        Object.getPrototypeOf(current) === null)
    const isMap = current instanceof Map
    const isSet = current instanceof Set
    const isFloatArray = current instanceof Float32Array || current instanceof Float64Array
    if (!Array.isArray(current) && !isPlainObject && !isMap && !isSet && !isFloatArray) {
      return serializeHashValue(current)
    }

    const object = current as object
    const reference = references.get(object)
    if (reference !== undefined) {
      return `reference:${reference}`
    }
    const nextReference = referenceIndex++
    references.set(object, nextReference)

    if (Array.isArray(current)) {
      const items = Array.from({ length: current.length }, (_, index) =>
        index in current ? ['value', serialize(current[index])] : ['hole']
      )
      return `array:${nextReference}:${JSON.stringify(items)}`
    }

    if (isMap) {
      const entries = [...current].map(([key, entryValue]) => [
        serialize(key),
        serialize(entryValue),
      ])
      return `map:${nextReference}:${JSON.stringify(entries)}`
    }

    if (isSet) {
      return `set:${nextReference}:${JSON.stringify([...current].map(serialize))}`
    }

    if (isFloatArray) {
      return `${current.constructor.name}:${nextReference}:${JSON.stringify([...current].map(serialize))}`
    }

    const record = current as Record<string, unknown>
    const entries = Object.keys(record)
      .sort()
      .map((key) => [key, serialize(record[key])])
    return `object:${nextReference}:${JSON.stringify(entries)}`
  }

  return serialize(value)
}

/** Compute storage TTL in seconds from cache options. */
export const computeTtlSeconds = (maxAge: number, staleMaxAge: number): number | undefined => {
  if (maxAge <= 0) {
    return 0
  }
  if (staleMaxAge < 0) {
    return undefined
  }
  return Math.max(0, maxAge + Math.max(0, staleMaxAge))
}

/** Check if a timestamp (ms) is expired. */
export const isExpired = (expires: number): boolean => Date.now() > expires

/** Check if stale cache is still valid. */
export const isStaleValid = (staleExpires: number | null): boolean => {
  if (staleExpires === null) {
    return true
  }
  return Date.now() <= staleExpires
}
