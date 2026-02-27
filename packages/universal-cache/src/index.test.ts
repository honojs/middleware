import { Hono } from 'hono'
import type { CacheDefaults } from './types'
import {
  cacheDefaults,
  cacheFunction,
  cacheMiddleware,
  createCacheStorage,
  getCacheDefaults,
  getCacheStorage,
  setCacheDefaults,
  setCacheStorage,
} from '.'

const resetDefaultOptions = () => {
  const defaults = {
    base: undefined,
    group: undefined,
    hash: undefined,
    integrity: undefined,
    keepPreviousOn5xx: undefined,
    maxAge: undefined,
    name: undefined,
    revalidateHeader: undefined,
    staleMaxAge: undefined,
    storage: undefined,
    swr: undefined,
  } as unknown as CacheDefaults
  setCacheDefaults(defaults)
}

const flushPromises = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

describe('@hono/universal-cache', () => {
  const toBase64 = (value: string) => Buffer.from(value).toString('base64')

  beforeEach(() => {
    resetDefaultOptions()
    setCacheStorage(createCacheStorage())
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  describe('cacheMiddleware', () => {
    it('caches GET responses', async () => {
      const app = new Hono()
      let count = 0

      app.get(
        '/items',
        cacheMiddleware({
          maxAge: 60,
          swr: false,
        }),
        (c) => {
          count += 1
          return c.text(String(count))
        }
      )

      const res1 = await app.request('http://localhost/items')
      const res2 = await app.request('http://localhost/items')

      expect(await res1.text()).toBe('1')
      expect(await res2.text()).toBe('1')
      expect(count).toBe(1)
    })

    it('does not cache methods outside GET/HEAD by default', async () => {
      const app = new Hono()
      let count = 0

      app.post('/items', cacheMiddleware({ maxAge: 60 }), (c) => {
        count += 1
        return c.text(String(count))
      })

      const res1 = await app.request('http://localhost/items', { method: 'POST' })
      const res2 = await app.request('http://localhost/items', { method: 'POST' })

      expect(await res1.text()).toBe('1')
      expect(await res2.text()).toBe('2')
      expect(count).toBe(2)
    })

    it('caches custom methods when configured', async () => {
      const app = new Hono()
      let count = 0

      app.post(
        '/items',
        cacheMiddleware({
          maxAge: 60,
          methods: ['POST'],
          swr: false,
        }),
        (c) => {
          count += 1
          return c.text(String(count))
        }
      )

      const res1 = await app.request('http://localhost/items', { method: 'POST' })
      const res2 = await app.request('http://localhost/items', { method: 'POST' })

      expect(await res1.text()).toBe('1')
      expect(await res2.text()).toBe('1')
      expect(count).toBe(1)
    })

    it('respects shouldBypassCache', async () => {
      const app = new Hono()
      let count = 0

      app.get(
        '/items',
        cacheMiddleware({
          maxAge: 60,
          swr: false,
          shouldBypassCache: (c) => c.req.header('x-bypass') === '1',
        }),
        (c) => {
          count += 1
          return c.text(String(count))
        }
      )

      const bypassed = await app.request('http://localhost/items', {
        headers: { 'x-bypass': '1' },
      })
      const cached = await app.request('http://localhost/items')
      const fromCache = await app.request('http://localhost/items')

      expect(await bypassed.text()).toBe('1')
      expect(await cached.text()).toBe('2')
      expect(await fromCache.text()).toBe('2')
      expect(count).toBe(2)
    })

    it('keeps previous cache on failed invalidation refresh when keepPreviousOn5xx is true', async () => {
      const app = new Hono()
      let status = 200
      let value = 'v1'

      app.get(
        '/items',
        cacheMiddleware({
          maxAge: 60,
          swr: false,
          keepPreviousOn5xx: true,
          shouldInvalidateCache: (c) => c.req.header('x-invalidate') === '1',
        }),
        (c) => c.text(value, status as 200 | 500)
      )

      const first = await app.request('http://localhost/items')
      expect(await first.text()).toBe('v1')

      status = 500
      value = 'v2'
      const refresh = await app.request('http://localhost/items', {
        headers: { 'x-invalidate': '1', 'x-cache-revalidate': '1' },
      })
      expect(refresh.status).toBe(500)

      status = 200
      value = 'v3'
      const cached = await app.request('http://localhost/items')
      expect(await cached.text()).toBe('v1')
    })

    it('drops previous cache on failed invalidation refresh when keepPreviousOn5xx is false', async () => {
      const app = new Hono()
      let status = 200
      let value = 'v1'

      app.get(
        '/items',
        cacheMiddleware({
          maxAge: 60,
          swr: false,
          keepPreviousOn5xx: false,
          shouldInvalidateCache: (c) => c.req.header('x-invalidate') === '1',
        }),
        (c) => c.text(value, status as 200 | 500)
      )

      const first = await app.request('http://localhost/items')
      expect(await first.text()).toBe('v1')

      status = 500
      value = 'v2'
      const refresh = await app.request('http://localhost/items', {
        headers: { 'x-invalidate': '1', 'x-cache-revalidate': '1' },
      })
      expect(refresh.status).toBe(500)

      status = 200
      value = 'v3'
      const fresh = await app.request('http://localhost/items')
      expect(await fresh.text()).toBe('v3')
    })

    it('invalidates and refreshes with the default revalidate header', async () => {
      const app = new Hono()
      let value = 'v1'

      app.get('/items', cacheMiddleware({ maxAge: 60, swr: false }), (c) => c.text(value))

      const first = await app.request('http://localhost/items')
      expect(await first.text()).toBe('v1')

      value = 'v2'
      const revalidated = await app.request('http://localhost/items', {
        headers: { 'x-cache-revalidate': '1' },
      })
      const cached = await app.request('http://localhost/items')

      expect(await revalidated.text()).toBe('v2')
      expect(await cached.text()).toBe('v2')
    })

    it('supports custom revalidate header', async () => {
      const app = new Hono()
      let value = 'v1'

      app.get(
        '/items',
        cacheMiddleware({
          maxAge: 60,
          swr: false,
          revalidateHeader: 'x-custom-revalidate',
        }),
        (c) => c.text(value)
      )

      await app.request('http://localhost/items')
      value = 'v2'
      await app.request('http://localhost/items', {
        headers: { 'x-custom-revalidate': '1' },
      })
      const cached = await app.request('http://localhost/items')

      expect(await cached.text()).toBe('v2')
    })

    it('applies defaults from cacheDefaults()', async () => {
      const app = new Hono()
      let count = 0

      app.use('*', cacheDefaults({ maxAge: 60, swr: false }))
      app.get('/items', cacheMiddleware(), (c) => {
        count += 1
        return c.text(String(count))
      })

      const res1 = await app.request('http://localhost/items')
      const res2 = await app.request('http://localhost/items')

      expect(await res1.text()).toBe('1')
      expect(await res2.text()).toBe('1')
      expect(count).toBe(1)
    })

    it('supports route-level config overrides via cacheMiddleware({ config })', async () => {
      const app = new Hono()
      let count = 0

      app.use('*', cacheDefaults({ maxAge: 60, swr: false }))
      app.get(
        '/items',
        cacheMiddleware({
          config: { maxAge: 0 },
          swr: false,
        }),
        (c) => {
          count += 1
          return c.text(String(count))
        }
      )

      const res1 = await app.request('http://localhost/items')
      const res2 = await app.request('http://localhost/items')

      expect(await res1.text()).toBe('1')
      expect(await res2.text()).toBe('2')
      expect(count).toBe(2)
    })

    it('keys by varies headers', async () => {
      const app = new Hono()
      let count = 0

      app.get(
        '/items',
        cacheMiddleware({
          maxAge: 60,
          swr: false,
          varies: ['accept-language'],
        }),
        (c) => {
          count += 1
          return c.text(String(count))
        }
      )

      const en1 = await app.request('http://localhost/items', {
        headers: { 'accept-language': 'en' },
      })
      const ar1 = await app.request('http://localhost/items', {
        headers: { 'accept-language': 'ar' },
      })
      const en2 = await app.request('http://localhost/items', {
        headers: { 'accept-language': 'en' },
      })

      expect(await en1.text()).toBe('1')
      expect(await ar1.text()).toBe('2')
      expect(await en2.text()).toBe('1')
      expect(count).toBe(2)
    })

    it('serves stale and revalidates in background once per key', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))

      const app = new Hono()
      let count = 0
      let fetchCalls = 0

      let resolveRefresh!: () => void
      const waitForRefresh = new Promise<void>((resolve) => {
        resolveRefresh = resolve
      })

      app.get(
        '/items',
        cacheMiddleware({
          maxAge: 1,
          staleMaxAge: 60,
          swr: true,
          getKey: () => 'stable-key',
        }),
        async (c) => {
          count += 1
          if (c.req.header('x-cache-revalidate') === '1') {
            await waitForRefresh
          }
          return c.text(String(count))
        }
      )

      const nativeFetch = globalThis.fetch
      vi.stubGlobal('fetch', (async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = input instanceof Request ? input : new Request(input, init)
        const url = new URL(request.url)
        if (url.hostname === 'localhost') {
          fetchCalls += 1
          return app.request(request)
        }
        return nativeFetch(input, init)
      }) as typeof fetch)

      const first = await app.request('http://localhost/items')
      expect(await first.text()).toBe('1')

      vi.advanceTimersByTime(1100)

      const stale1 = await app.request('http://localhost/items')
      const stale2 = await app.request('http://localhost/items')

      expect(await stale1.text()).toBe('1')
      expect(await stale2.text()).toBe('1')
      expect(fetchCalls).toBe(1)

      resolveRefresh()
      await flushPromises()
      await flushPromises()

      expect(count).toBe(2)
    })

    it('does not cache non-cacheable responses with set-cookie', async () => {
      const app = new Hono()
      let count = 0

      app.get('/items', cacheMiddleware({ maxAge: 60 }), (c) => {
        count += 1
        c.header('set-cookie', `s=${count}; Path=/`)
        return c.text(String(count))
      })

      const res1 = await app.request('http://localhost/items')
      const res2 = await app.request('http://localhost/items')

      expect(await res1.text()).toBe('1')
      expect(await res2.text()).toBe('2')
      expect(count).toBe(2)
    })

    it('supports custom serialize/deserialize for responses', async () => {
      const app = new Hono()
      let count = 0

      app.get(
        '/items',
        cacheMiddleware({
          maxAge: 60,
          swr: false,
          serialize: async (response, context) => ({
            value: await response.clone().text(),
            encoding: 'base64',
            status: response.status,
            headers: {
              'content-type': response.headers.get('content-type') ?? 'text/plain;charset=UTF-8',
            },
            mtime: context.now,
            expires: context.now + context.maxAge * 1000,
            staleExpires: context.now + context.maxAge * 1000,
            integrity: context.integrity,
          }),
          deserialize: (entry) =>
            new Response(entry.value, {
              status: entry.status,
              headers: entry.headers,
            }),
        }),
        (c) => {
          count += 1
          return c.text(`value-${count}`)
        }
      )

      const res1 = await app.request('http://localhost/items')
      const res2 = await app.request('http://localhost/items')

      expect(await res1.text()).toBe('value-1')
      expect(await res2.text()).toBe('value-1')
      expect(count).toBe(1)
    })

    it('removes invalid cached response entries', async () => {
      const storage = createCacheStorage()
      const app = new Hono()
      let count = 0

      const base = 'cache'
      const group = 'hono/handlers'
      const name = 'items'
      const key = 'manual-key'
      const storageKey = `${base}:${group}:${name}:${key}.json`

      await storage.setItem(storageKey, { value: 1 })

      app.get(
        '/items',
        cacheMiddleware({
          storage,
          name,
          getKey: () => key,
          maxAge: 60,
          swr: false,
        }),
        (c) => {
          count += 1
          return c.text(`value-${count}`)
        }
      )

      const res = await app.request('http://localhost/items')
      const cachedRaw = await (storage.getItem(storageKey) as Promise<unknown>)

      expect(await res.text()).toBe('value-1')
      expect(count).toBe(1)
      expect(cachedRaw).toBeTypeOf('object')
      expect(cachedRaw).not.toBeNull()
      if (!cachedRaw || typeof cachedRaw !== 'object') {
        throw new Error('Expected cached response entry object')
      }
      expect((cachedRaw as { value?: unknown }).value).toBeTypeOf('string')
    })

    it('falls back to safe key prefix when path decoding fails', async () => {
      const app = new Hono()
      let count = 0

      app.get('*', cacheMiddleware({ maxAge: 60, swr: false }), (c) => {
        count += 1
        return c.text(String(count))
      })

      const url = 'http://localhost/%E0%A4%A'
      const res1 = await app.request(url)
      const res2 = await app.request(url)

      expect(await res1.text()).toBe('1')
      expect(await res2.text()).toBe('1')
      expect(count).toBe(1)
    })

    it('drops cached response entries with integrity mismatch', async () => {
      const storage = createCacheStorage()
      const app = new Hono()
      let count = 0

      const storageKey = 'cache:hono/handlers:items:key.json'
      await storage.setItem(storageKey, {
        value: toBase64('stale'),
        encoding: 'base64',
        status: 200,
        headers: { 'content-type': 'text/plain' },
        mtime: Date.now(),
        expires: Date.now() + 60_000,
        staleExpires: Date.now() + 120_000,
        integrity: 'stale-integrity',
      })

      app.get(
        '/items',
        cacheMiddleware({
          storage,
          name: 'items',
          getKey: () => 'key',
          maxAge: 60,
          swr: false,
          integrity: 'fresh-integrity',
        }),
        (c) => {
          count += 1
          return c.text(`value-${count}`)
        }
      )

      const res = await app.request('http://localhost/items')
      expect(await res.text()).toBe('value-1')
      expect(count).toBe(1)
    })

    it('drops cached response entries rejected by validate()', async () => {
      const storage = createCacheStorage()
      const app = new Hono()
      let count = 0

      const storageKey = 'cache:hono/handlers:items:key.json'
      await storage.setItem(storageKey, {
        value: toBase64('stale'),
        encoding: 'base64',
        status: 200,
        headers: { 'content-type': 'text/plain' },
        mtime: Date.now(),
        expires: Date.now() + 60_000,
        staleExpires: Date.now() + 120_000,
        integrity: 'integrity',
      })

      app.get(
        '/items',
        cacheMiddleware({
          storage,
          name: 'items',
          getKey: () => 'key',
          maxAge: 60,
          swr: false,
          integrity: 'integrity',
          validate: () => false,
        }),
        (c) => {
          count += 1
          return c.text(`value-${count}`)
        }
      )

      const res = await app.request('http://localhost/items')
      expect(await res.text()).toBe('value-1')
      expect(count).toBe(1)
    })

    it('treats etag/last-modified header value "undefined" as invalid cache entry', async () => {
      const storage = createCacheStorage()
      const app = new Hono()
      let count = 0

      await storage.setItem('cache:hono/handlers:etag:key.json', {
        value: toBase64('stale'),
        encoding: 'base64',
        status: 200,
        headers: { etag: 'undefined' },
        mtime: Date.now(),
        expires: Date.now() + 60_000,
        staleExpires: Date.now() + 120_000,
        integrity: 'integrity',
      })

      await storage.setItem('cache:hono/handlers:last-mod:key.json', {
        value: toBase64('stale'),
        encoding: 'base64',
        status: 200,
        headers: { 'last-modified': 'undefined' },
        mtime: Date.now(),
        expires: Date.now() + 60_000,
        staleExpires: Date.now() + 120_000,
        integrity: 'integrity',
      })

      app.get(
        '/etag',
        cacheMiddleware({
          storage,
          name: 'etag',
          getKey: () => 'key',
          maxAge: 60,
          swr: false,
          integrity: 'integrity',
        }),
        (c) => {
          count += 1
          return c.text(`value-${count}`)
        }
      )

      app.get(
        '/last-mod',
        cacheMiddleware({
          storage,
          name: 'last-mod',
          getKey: () => 'key',
          maxAge: 60,
          swr: false,
          integrity: 'integrity',
        }),
        (c) => {
          count += 1
          return c.text(`value-${count}`)
        }
      )

      const etagRes = await app.request('http://localhost/etag')
      const lastModRes = await app.request('http://localhost/last-mod')

      expect(await etagRes.text()).toBe('value-1')
      expect(await lastModRes.text()).toBe('value-2')
      expect(count).toBe(2)
    })

    it('evicts old cache when invalidated response is non-cacheable with keepPreviousOn5xx=true', async () => {
      const app = new Hono()
      let value = 'v1'
      let noStore = false

      app.get(
        '/items',
        cacheMiddleware({
          maxAge: 60,
          swr: false,
          keepPreviousOn5xx: true,
          shouldInvalidateCache: (c) => c.req.header('x-invalidate') === '1',
        }),
        (c) => {
          if (noStore) {
            c.header('cache-control', 'no-store')
          }
          return c.text(value)
        }
      )

      expect(await (await app.request('http://localhost/items')).text()).toBe('v1')

      value = 'v2'
      noStore = true
      const refresh = await app.request('http://localhost/items', {
        headers: { 'x-cache-revalidate': '1', 'x-invalidate': '1' },
      })
      expect(await refresh.text()).toBe('v2')

      value = 'v3'
      noStore = false
      const next = await app.request('http://localhost/items')
      expect(await next.text()).toBe('v3')
    })
  })

  describe('cacheFunction', () => {
    it('caches function results', async () => {
      let count = 0

      const fn = cacheFunction(
        (id: string) => {
          count += 1
          return `${id}-${count}`
        },
        {
          maxAge: 60,
          swr: false,
          getKey: (id) => id,
        }
      )

      const a = await fn('x')
      const b = await fn('x')

      expect(a).toBe('x-1')
      expect(b).toBe('x-1')
      expect(count).toBe(1)
    })

    it('deduplicates concurrent calls', async () => {
      let count = 0

      const fn = cacheFunction(
        async (id: string) => {
          count += 1
          await Promise.resolve()
          return `${id}-${count}`
        },
        {
          maxAge: 60,
          swr: false,
          getKey: (id) => id,
        }
      )

      const [a, b, c] = await Promise.all([fn('x'), fn('x'), fn('x')])

      expect(a).toBe('x-1')
      expect(b).toBe('x-1')
      expect(c).toBe('x-1')
      expect(count).toBe(1)
    })

    it('respects shouldBypassCache for functions', async () => {
      let count = 0
      let bypass = false

      const fn = cacheFunction(
        (id: string) => {
          count += 1
          return `${id}-${count}`
        },
        {
          maxAge: 60,
          swr: false,
          getKey: (id) => id,
          shouldBypassCache: () => bypass,
        }
      )

      const a = await fn('x')
      bypass = true
      const b = await fn('x')
      bypass = false
      const c = await fn('x')

      expect(a).toBe('x-1')
      expect(b).toBe('x-2')
      expect(c).toBe('x-1')
      expect(count).toBe(2)
    })

    it('removes cache before invalidation refresh when keepPreviousOn5xx is false', async () => {
      const storage = createCacheStorage()
      let count = 0
      let shouldInvalidate = false
      let shouldThrow = false

      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))

      const fn = cacheFunction(
        () => {
          count += 1
          if (shouldThrow) {
            throw new Error('boom')
          }
          return `v${count}`
        },
        {
          storage,
          base: 'base',
          group: 'group',
          name: 'name',
          getKey: () => 'key',
          maxAge: 1,
          staleMaxAge: 0,
          swr: false,
          keepPreviousOn5xx: false,
          shouldInvalidateCache: () => shouldInvalidate,
        }
      )

      await fn()

      vi.advanceTimersByTime(1100)

      shouldInvalidate = true
      shouldThrow = true
      await expect(fn()).rejects.toThrow('boom')

      const cached = await storage.getItem('base:group:name:key.json')
      expect(cached).toBeNull()
    })

    it('keeps previous cache before invalidation refresh when keepPreviousOn5xx is true', async () => {
      const storage = createCacheStorage()
      let count = 0
      let shouldInvalidate = false
      let shouldThrow = false

      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))

      const fn = cacheFunction(
        () => {
          count += 1
          if (shouldThrow) {
            throw new Error('boom')
          }
          return `v${count}`
        },
        {
          storage,
          base: 'base',
          group: 'group',
          name: 'name',
          getKey: () => 'key',
          maxAge: 1,
          staleMaxAge: 0,
          swr: false,
          keepPreviousOn5xx: true,
          shouldInvalidateCache: () => shouldInvalidate,
        }
      )

      await fn()

      vi.advanceTimersByTime(1100)

      shouldInvalidate = true
      shouldThrow = true
      await expect(fn()).rejects.toThrow('boom')

      const cached = await storage.getItem('base:group:name:key.json')
      expect(cached).not.toBeNull()
    })

    it('supports custom serialize/deserialize for functions', async () => {
      let count = 0

      const fn = cacheFunction(
        () => {
          count += 1
          return { value: count }
        },
        {
          maxAge: 60,
          swr: false,
          getKey: () => 'key',
          serialize: (result, context) => ({
            value: JSON.stringify(result),
            mtime: context.now,
            expires: context.now + context.maxAge * 1000,
            staleExpires: context.now + context.maxAge * 1000,
            integrity: context.integrity,
          }),
          deserialize: (entry) => {
            if (typeof entry.value !== 'string') {
              throw new TypeError('Expected serialized string value')
            }
            return JSON.parse(entry.value) as { value: number }
          },
        }
      )

      const a = await fn()
      const b = await fn()

      expect(a).toEqual({ value: 1 })
      expect(b).toEqual({ value: 1 })
      expect(count).toBe(1)
    })

    it('supports validate hook for function entries', async () => {
      let count = 0
      let valid = true

      const fn = cacheFunction(
        () => {
          count += 1
          return `v${count}`
        },
        {
          maxAge: 60,
          swr: false,
          getKey: () => 'key',
          validate: () => valid,
        }
      )

      await fn()
      valid = false
      const second = await fn()

      expect(second).toBe('v2')
      expect(count).toBe(2)
    })

    it('serves stale and refreshes function cache in background', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))

      let count = 0

      const fn = cacheFunction(
        () => {
          count += 1
          return `v${count}`
        },
        {
          maxAge: 1,
          staleMaxAge: 60,
          swr: true,
          getKey: () => 'key',
        }
      )

      const first = await fn()
      vi.advanceTimersByTime(1100)

      const stale = await fn()
      await flushPromises()
      const refreshed = await fn()

      expect(first).toBe('v1')
      expect(stale).toBe('v1')
      expect(refreshed).toBe('v2')
    })

    it('bypasses cache when maxAge is zero', async () => {
      let count = 0

      const fn = cacheFunction(
        () => {
          count += 1
          return count
        },
        { maxAge: 0 }
      )

      const a = await fn()
      const b = await fn()

      expect(a).toBe(1)
      expect(b).toBe(2)
      expect(count).toBe(2)
    })

    it('uses default argument hashing when getKey is omitted', async () => {
      let count = 0
      const fn = cacheFunction(
        (input: { id: string }) => {
          count += 1
          return `${input.id}-${count}`
        },
        { maxAge: 60, swr: false }
      )

      const a = await fn({ id: 'x' })
      const b = await fn({ id: 'x' })

      expect(a).toBe('x-1')
      expect(b).toBe('x-1')
      expect(count).toBe(1)
    })

    it('removes malformed function cache entries before computing fresh value', async () => {
      const storage = createCacheStorage()
      let count = 0

      await storage.setItem('cache:hono/functions:fn:key.json', 123 as unknown as object)

      const fn = cacheFunction(
        () => {
          count += 1
          return `v${count}`
        },
        {
          storage,
          base: 'cache',
          group: 'hono/functions',
          name: 'fn',
          getKey: () => 'key',
          maxAge: 60,
          swr: false,
        }
      )

      const value = await fn()
      expect(value).toBe('v1')
      expect(count).toBe(1)
    })
  })

  describe('global cache accessors', () => {
    it('sets and gets global cache defaults and storage', () => {
      const storage = createCacheStorage()
      const defaults = { maxAge: 120, staleMaxAge: 30 }

      setCacheStorage(storage)
      setCacheDefaults(defaults)

      expect(getCacheStorage()).toBe(storage)
      expect(getCacheDefaults()).toMatchObject(defaults)
    })
  })
})
