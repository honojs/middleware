# @hono/universal-cache

[![codecov](https://codecov.io/github/honojs/middleware/graph/badge.svg?flag=universal-cache)](https://codecov.io/github/honojs/middleware)

Storage-agnostic response and function caching for Hono.

## Features

- Response caching with `cacheMiddleware()`
- Function result caching with `cacheFunction()`
- Request-scoped defaults with `cacheDefaults()`
- In-flight deduplication for response and function cache fills
- Stale-while-revalidate for cached functions
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

The default storage is an in-memory `unstorage` instance scoped to the current process or isolate. It expires entries and is limited to 1,000 entries, 50 MiB total, and 5 MiB per entry. Configure a persistent or distributed driver for multi-instance deployments.

Custom storage drivers must bound their own operation latency. A storage promise that never settles also prevents the cache operation from settling.

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
  })
)

app.get('/api/items', cacheMiddleware(), (c) => c.json({ ok: true }))
```

`cacheDefaults()` applies defaults to downstream cache middleware for the current request. Route-local options override request-scoped and process-wide defaults. Use `setCacheDefaults()` and `setCacheStorage()` for process-wide defaults, including `cacheFunction()`.

`setCacheDefaults()` replaces the current defaults. Call `setCacheDefaults({})` to reset them. Cached functions resolve global defaults when called, so later changes apply to existing wrappers. Options passed directly to `cacheFunction()` continue to take precedence.

## Cache keys

Default response keys include:

- HTTP method and origin
- URL path and query
- request body for explicitly enabled non-`GET`/`HEAD` methods
- configured `varies` headers

Requests containing `authorization` or `cookie` are not cached by default. To cache them, explicitly include the header in `varies` or provide a custom `getKey`.

Range, conditional, and client no-cache requests bypass cache reads and writes so the application can apply their HTTP semantics.

Use `getKey` when the cache identity depends on application-specific context:

```ts
cacheMiddleware({
  getKey: (c) => `${c.req.param('tenant')}:${c.req.query('page') ?? '1'}`,
  maxAge: 60,
})
```

`getKey` replaces the complete default key. Include every relevant tenant, authorization, cookie, method, body, and variation value when providing one. A custom key opts credentialed requests into caching, so it owns their isolation.

When a response uses `Vary`, list every corresponding request header in `varies`, including when using `getKey`. Responses with `Vary: *` or an unlisted `Vary` field are never cached.

## Manual revalidation

Manual revalidation is disabled by default. Enable it with a private header name and gate it with `shouldRevalidate`:

```ts
cacheMiddleware({
  revalidateHeader: 'x-my-cache-revalidate',
  shouldRevalidate: (c) => c.req.header('x-cache-token') === process.env.CACHE_TOKEN,
})
```

A request with `x-my-cache-revalidate: 1` refreshes the entry only when `shouldRevalidate` allows it. Do not expose an ungated revalidation header on public endpoints.
Use a dedicated gate header when possible. An authorized revalidation runs the route handler with the original request headers, so do not cache a personalized response under a public key.

## Bypass and invalidation

```ts
cacheMiddleware({
  shouldBypassCache: (c) => c.req.header('x-preview') === '1',
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
})
```

After `maxAge`, middleware entries refresh synchronously on every runtime. If the refresh throws or returns a 5xx response, the middleware serves the previous response while it remains within `staleMaxAge`. Use `staleMaxAge: -1` for unlimited stale fallback with a persistent storage driver.

Function caches use `swr: true` by default. They serve stale values and refresh them in the background. Set `swr: false` on `cacheFunction()` to refresh synchronously.

## Function caching

```ts
import { cacheFunction } from '@hono/universal-cache'

const getStats = cacheFunction(async (id: string) => ({ id, ts: Date.now() }), {
  name: 'get-stats',
  maxAge: 60,
  getKey: (id) => id,
})
```

Without `getKey`, arguments are deterministically serialized with type information and hashed. This distinguishes values such as a `Date` from the same ISO string, `0` from `-0`, and supports common values including `Map`, `Set`, and `BigInt`. Provide `getKey` for identity-sensitive values such as symbols, functions, or sparse arrays.

Implicit function names are process-local to prevent separate closures from sharing cached values. Set an explicit stable `name` for persistent or distributed caching across processes, and keep that name unique for each logical function.

Concurrent calls for the same storage, key, and integrity value share one in-flight operation. Different storage instances remain isolated.

Default function serialization uses JSON through `unstorage`. It safely preserves JSON-compatible results only. Values such as `Date`, `Map`, `Set`, class instances, and `BigInt` require custom `serialize` and `deserialize` functions when their type or shape must be preserved.

## Custom serialization and validation

`serialize`, `deserialize`, and `validate` can adapt stored entries or reject obsolete data. Custom response serializers must return the `CachedResponseEntry` shape, including `encoding: 'base64'`. The default response serializer stops after 3 MiB or one second and does not delay delivery while caching. Custom serializers own equivalent body and time limits. Use `integrity` to invalidate entries when their schema or behavior changes.

## API

- `cacheMiddleware(options | maxAge)`
- `cacheDefaults(options)`
- `cacheFunction(fn, options | maxAge)`
- `createCacheStorage({ maxEntries?, maxSize?, maxEntrySize? })`
- `setCacheStorage(storage)` / `getCacheStorage()`
- `setCacheDefaults(options)` / `getCacheDefaults()`
- `stableStringify(value)`

Exported types include `CacheBaseOptions`, `CacheDefaults`, `CacheStorageOptions`, `CacheMiddlewareOptions`, `CacheFunctionOptions`, `CachedResponseEntry`, and `CachedFunctionEntry`.

## Response safety

The middleware does not cache:

- responses outside the 2xx range or HTTP 206 partial responses
- responses containing `set-cookie`
- responses marked `private`, `no-store`, or `no-cache`
- common streaming responses such as SSE, NDJSON, JSON sequences, and mixed multipart streams
- responses containing `Vary: *` or a `Vary` header not covered by `varies`
- malformed persisted entries

Cached responses exclude `set-cookie`, `content-length`, and other hop-by-hop headers.
Cache hits include an `Age` header based on the stored age plus resident time.
Set `Cache-Control: no-store` on custom streaming response types so they are not buffered for caching.

## Author

Raed B. <https://github.com/lord007tn>

## License

MIT
