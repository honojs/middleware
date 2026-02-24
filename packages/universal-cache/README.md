# @hono/universal-cache

[![codecov](https://codecov.io/github/honojs/middleware/graph/badge.svg?flag=universal-cache)](https://codecov.io/github/honojs/middleware)

Universal cache utilities for Hono.

## Features

- Response caching with `cacheMiddleware()`
- Function result caching with `cacheFunction()`
- Stale-while-revalidate support
- Cache defaults via middleware `cacheDefaults()`
- Custom keying, storage, serialization, and validation

## Usage

```ts
import { Hono } from 'hono'
import { cacheMiddleware } from '@hono/universal-cache'

const app = new Hono()

app.get('/items', cacheMiddleware(60), (c) => c.json({ ok: true }))
```

## Configure defaults

```ts
import { Hono } from 'hono'
import { cacheDefaults } from '@hono/universal-cache'
import { createStorage } from 'unstorage'
import memoryDriver from 'unstorage/drivers/memory'

const app = new Hono()

app.use(
  cacheDefaults({
    storage: createStorage({ driver: memoryDriver() }),
    maxAge: 60,
    staleMaxAge: 30,
    swr: true,
  })
)
```

## Cached function

```ts
import { cacheFunction } from '@hono/universal-cache'

const getStats = cacheFunction(async (id: string) => ({ id, ts: Date.now() }), {
  maxAge: 60,
  getKey: (id) => id,
})
```

## API

- `cacheMiddleware(options | maxAge)`
- `cacheDefaults(options)`
- `cacheFunction(fn, options | maxAge)`
- `setCacheStorage(storage)` / `getCacheStorage()`
- `setCacheDefaults(options)` / `getCacheDefaults()`
- `createCacheStorage()`

## Notes

- Cached responses drop `set-cookie` and hop-by-hop headers.
- Default revalidate header is `x-cache-revalidate`.
- Middleware cache defaults to `GET` and `HEAD`.

## Author

Raed B. <https://github.com/lord007tn>

## License

MIT
