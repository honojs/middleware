---
'@hono/universal-cache': minor
---

Add `@hono/universal-cache`, a universal cache toolkit for Hono with:

- `cacheMiddleware()` for response caching
- `cacheDefaults()` for scoped defaults
- `cacheFunction()` for caching async function results
- stale-if-error response fallback and stale-while-revalidate function caching
- bounded in-flight deduplication for response and function cache fills
- bounded TTL-aware in-memory storage by default
- safe response streaming, header replay, and persisted-entry validation
- storage/default accessors (`set/getCacheStorage`, `set/getCacheDefaults`)
- custom keying, serialization, validation, and invalidation hooks
