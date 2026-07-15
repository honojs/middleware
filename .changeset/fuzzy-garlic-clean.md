---
'@hono/universal-cache': minor
---

Add `@hono/universal-cache`, a universal cache toolkit for Hono with:

- `cacheMiddleware()` for response caching
- `cacheDefaults()` for scoped defaults
- `cacheFunction()` for caching async function results
- stale-if-error response fallback and stale-while-revalidate function caching
- bounded TTL-aware in-memory storage by default
- storage/default accessors (`set/getCacheStorage`, `set/getCacheDefaults`)
- custom keying, serialization, validation, and invalidation hooks
