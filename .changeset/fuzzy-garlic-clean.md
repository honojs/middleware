---
'@hono/universal-cache': minor
---

Add `@hono/universal-cache`, a universal cache toolkit for Hono with:

- `cacheMiddleware()` for response caching
- `cacheDefaults()` and deprecated `cacheConfig()` for scoped defaults
- `cacheFunction()` for caching async function results
- stale-while-revalidate support
- storage/default accessors (`set/getCacheStorage`, `set/getCacheDefaults`)
- custom keying, serialization, validation, and invalidation hooks
