# Response Cache for Hono
Response cache for [Hono](https://honojs.dev) with `Bring Your Own` cache store.

## Usage
### Basic with `in-memory` cache:
```ts
import { Hono } from 'hono'
import { cacheMiddleware } from '@hono/response-cache'

const cacheStorage = new Map<string, string>()
const cache = cacheMiddleware({
  store: {
    get: (key) => cacheStorage.get(key),
    set: (key, value) => {
      cacheStorage.set(key, value)
    },
    delete: (key) => {
      cacheStorage.delete(key)
    },
  },
})

const app = new Hono()
app.use('*', cache)
```

### Redis (and custom key function)
```ts
import { Hono } from 'hono'
import { cacheMiddleware } from '@hono/response-cache'
import { createClient } from '@redis/client'

const redisClient = createClient({
  url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
})

const store = {
  get: async (key: string) => {
    return (await redisClient.get(key)) ?? null
  },
  set: async (key: string, value: string) => {
    await redisClient.set(key, value)
    return
  },
  invalidate: async (key: string) => {
    await redisClient.del(key)
    return
  },
}

const cache = cacheMiddleware({
  store,
  keyFn: (req, c) => `hono_res_cache_${c.req.path}`,
})

app.use('*', cache)
```

### Add logging
```ts
import { cacheMiddleware } from '@hono/response-cache'

const cache = cacheMiddleware({
  store,
  logging: {
    enabled: true,
    onHit: (key, c) => console.log(`Cache hit for ${key}`),
    onMiss: (key, c) => console.log(`Cache miss for ${key}`),
    onError: (key, c) => console.log(`Cache error for ${key}, error:`, error),
  },
})
```

## Author

Rokas Muningis <https://github.com/muningis>

## License

MIT