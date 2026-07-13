# @hono/universal-cache

[![codecov](https://codecov.io/github/honojs/middleware/graph/badge.svg?flag=universal-cache)](https://codecov.io/github/honojs/middleware)

Storage-agnostic response and function caching for Hono.

## Features

- Response caching with `cacheMiddleware()`
- Function result caching with `cacheFunction()`
- Request-scoped defaults with `cacheDefaults()`
- Stale-while-revalidate and in-flight request deduplication
- Custom storage, keys, integrity values, serialization, and validation
- Explicit bypass, invalidation, and manual revalidation hooks
- Node.js, Bun, Deno, and Cloudflare Workers-compatible Web APIs

## Installation

```sh
pnpm add @hono/universal-cache
```

## Response caching

```ts
import { Hono } from 'hono'
import { cacheMiddleware } from '@hono/universal-cache'

const app = new Hono()

app.get('/items', cacheMiddleware(60), (c) => c.json({ ok: true }))
```

Passing a number is shorthand for `{ maxAge: number }`. `GET` and `HEAD` are cached by default.

## Storage and defaults

The default storage is an in-memory `unstorage` instance scoped to the current process or isolate. Configure a persistent or distributed driver for multi-instance deployments.

```ts
import { Hono } from 'hono'
import { cacheDefaults, cacheMiddleware } from '@hono/universal-cache'
import { createStorage } from 'unstorage'
import redisDriver from 'unstorage/drivers/redis'

const app = new Hono()

app.use(
  '/api/*',
  cacheDefaults({
    storage: createStorage({ driver: redisDriver({ url: process.env.REDIS_URL }) }),
    maxAge: 60,
    staleMaxAge: 30,
    swr: true,
  })
)

app.get('/api/items', cacheMiddleware(), (c) => c.json({ ok: true }))
```

`cacheDefaults()` applies defaults to downstream cache middleware for the current request. Use `setCacheDefaults()` and `setCacheStorage()` for process-wide defaults, including `cacheFunction()`.

Route-local options override request-scoped and process-wide defaults:

```ts
app.get(
  '/api/items',
  cacheMiddleware({
    config: { maxAge: 120 },
    staleMaxAge: 60,
  }),
  handler
)
```

## Cache keys

Default response keys include:

- HTTP method and origin
- URL path and query
- request body for explicitly enabled non-`GET`/`HEAD` methods
- configured `varies` headers
- `authorization` and `cookie` headers when present

Use `getKey` when the cache identity depends on application-specific context:

```ts
cacheMiddleware({
  getKey: (c) => `${c.req.param('tenant')}:${c.req.query('page') ?? '1'}`,
  maxAge: 60,
})
```

`getKey` replaces the complete default key. Include every relevant tenant, authorization, cookie, method, body, and variation value when providing one.

When a response uses `Vary`, list the corresponding request headers in `varies`. Responses with `Vary: *` are never cached.

## Manual revalidation

Manual revalidation is disabled by default. Enable it with a private header name and gate it with `shouldRevalidate`:

```ts
cacheMiddleware({
  revalidateHeader: 'x-my-cache-revalidate',
  shouldRevalidate: (c) => c.req.header('authorization') === `Bearer ${process.env.CACHE_TOKEN}`,
})
```

A request with `x-my-cache-revalidate: 1` refreshes the entry only when `shouldRevalidate` allows it. Do not expose an ungated revalidation header on public endpoints.

## Bypass and invalidation

```ts
cacheMiddleware({
  shouldBypassCache: (c) => c.req.header('cache-control') === 'no-cache',
  shouldInvalidateCache: (c) => c.req.query('refresh') === '1',
  keepPreviousOn5xx: true,
})
```

- `shouldBypassCache` skips both cache reads and writes.
- `shouldInvalidateCache` skips the current entry and refreshes it.
- `keepPreviousOn5xx` preserves the previous entry when an invalidation refresh returns a 5xx response. It preserves function entries when the wrapped function throws.

## Stale-while-revalidate

```ts
cacheMiddleware({
  maxAge: 60,
  staleMaxAge: 300,
  swr: true,
})
```

After `maxAge`, stale entries remain usable for `staleMaxAge` seconds. Use `staleMaxAge: -1` for unlimited stale storage.

Standard runtimes serve the stale response and perform a deduplicated background self-fetch. Cloudflare Workers refresh stale middleware entries synchronously because background self-fetch behaves differently under `workerd`. Function caches refresh stale values in the background on every runtime.

## Function caching

```ts
import { cacheFunction } from '@hono/universal-cache'

const getStats = cacheFunction(async (id: string) => ({ id, ts: Date.now() }), {
  maxAge: 60,
  getKey: (id) => id,
})
```

Without `getKey`, arguments are deterministically serialized and hashed. Default argument serialization supports JSON-compatible values and `Date`. Provide `getKey` for values such as `Map`, `Set`, `BigInt`, cyclic structures, or class instances.

Concurrent calls for the same storage, key, and integrity value share one in-flight operation. Different storage instances remain isolated.

## Custom serialization and validation

`serialize`, `deserialize`, and `validate` can adapt stored entries or reject obsolete data. Custom response serializers must return the `CachedResponseEntry` shape, including `encoding: 'base64'`. Use `integrity` to invalidate entries when their schema or behavior changes.

## API

- `cacheMiddleware(options | maxAge)`
- `cacheDefaults(options)`
- `cacheFunction(fn, options | maxAge)`
- `createCacheStorage()`
- `setCacheStorage(storage)` / `getCacheStorage()`
- `setCacheDefaults(options)` / `getCacheDefaults()`
- `stableStringify(value)`

Exported types include `CacheBaseOptions`, `CacheConfigOptions`, `CacheDefaults`, `CacheMiddlewareOptions`, `CacheFunctionOptions`, `CachedResponseEntry`, and `CachedFunctionEntry`.

## Response safety

The middleware does not cache:

- responses outside the 2xx range or HTTP 206 partial responses
- responses containing `set-cookie`
- responses marked `private`, `no-store`, or `no-cache`
- responses containing `Vary: *`
- malformed persisted entries

Cached responses exclude `set-cookie`, `content-length`, and other hop-by-hop headers.

## Author

Raed B. <https://github.com/lord007tn>

## License

MIT
