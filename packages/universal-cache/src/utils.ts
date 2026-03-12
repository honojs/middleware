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

/** Stable stringification with sorted object keys. */
export const stableStringify = (value: unknown): string => {
  if (value === null || value === undefined) {
    return String(value)
  }
  if (typeof value !== 'object') {
    return JSON.stringify(value)
  }
  if (value instanceof Date) {
    return JSON.stringify(value.toISOString())
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`
  }
  const record = value as Record<string, unknown>
  const keys = Object.keys(record).sort()
  const entries = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
  return `{${entries.join(',')}}`
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
