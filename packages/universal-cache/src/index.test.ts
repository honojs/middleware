import { Hono } from 'hono'
import {
  cacheDefaults,
  cacheFunction,
  cacheMiddleware,
  createCacheStorage,
  getCacheDefaults,
  getCacheStorage,
  setCacheDefaults,
  setCacheStorage,
  stableStringify,
} from '.'

const resetDefaultOptions = () => {
  setCacheDefaults({})
}

const flushPromises = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

const createTestStorageKey = (...segments: string[]) =>
  `${segments.map((segment) => encodeURIComponent(segment)).join(':')}.json`

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

    it('coalesces concurrent cache misses', async () => {
      const app = new Hono()
      let count = 0
      let release: (() => void) | undefined
      const gate = new Promise<void>((resolve) => {
        release = resolve
      })

      app.get('/items', cacheMiddleware({ maxAge: 60 }), async (c) => {
        count += 1
        await gate
        return c.text(String(count))
      })

      const pending = Array.from({ length: 200 }, () =>
        Promise.resolve(app.request('http://localhost/items'))
      )
      await vi.waitFor(() => {
        expect(count).toBe(1)
      })
      release?.()

      const responses = await Promise.all(pending)
      expect(await Promise.all(responses.map((response) => response.text()))).toEqual(
        Array.from({ length: 200 }, () => '1')
      )
      expect(count).toBe(1)
    })

    it('coalesces concurrent stale refreshes', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
      const app = new Hono()
      let count = 0
      let release: (() => void) | undefined
      let gate = Promise.resolve()

      app.get('/items', cacheMiddleware({ maxAge: 1, staleMaxAge: 60 }), async (c) => {
        count += 1
        await gate
        return c.text(String(count))
      })

      expect(await (await app.request('http://localhost/items')).text()).toBe('1')
      vi.advanceTimersByTime(1100)
      gate = new Promise<void>((resolve) => {
        release = resolve
      })

      const pending = Array.from({ length: 100 }, () =>
        Promise.resolve(app.request('http://localhost/items'))
      )
      await vi.waitFor(() => {
        expect(count).toBe(2)
      })
      release?.()

      const responses = await Promise.all(pending)
      expect(await Promise.all(responses.map((response) => response.text()))).toEqual(
        Array.from({ length: 100 }, () => '2')
      )
      expect(count).toBe(2)
    })

    it('coalesces concurrent 5xx responses without caching them', async () => {
      const app = new Hono()
      let count = 0
      let release: (() => void) | undefined
      const gate = new Promise<void>((resolve) => {
        release = resolve
      })

      app.get('/items', cacheMiddleware({ maxAge: 60 }), async (c) => {
        count += 1
        await gate
        return c.text('unavailable', 503)
      })

      const pending = Array.from({ length: 200 }, () =>
        Promise.resolve(app.request('http://localhost/items'))
      )
      await vi.waitFor(() => {
        expect(count).toBe(1)
      })
      release?.()

      const responses = await Promise.all(pending)
      expect(responses.every((response) => response.status === 503)).toBe(true)
      expect(count).toBe(1)
      expect((await app.request('http://localhost/items')).status).toBe(503)
      expect(count).toBe(2)
    })

    it('retries followers when the coalesced leader is aborted', async () => {
      const app = new Hono()
      const controller = new AbortController()
      let count = 0

      app.get('/items', cacheMiddleware({ maxAge: 60 }), async (c) => {
        count += 1
        if (count === 1) {
          await new Promise<void>((resolve) => {
            c.req.raw.signal.addEventListener(
              'abort',
              () => {
                resolve()
              },
              { once: true }
            )
          })
          return new Response('aborted', { status: 599 })
        }
        return c.text('ok')
      })

      const leader = app.request('http://localhost/items', { signal: controller.signal })
      await vi.waitFor(() => {
        expect(count).toBe(1)
      })
      const follower = app.request('http://localhost/items')
      controller.abort()

      expect((await leader).status).toBe(599)
      expect(await (await follower).text()).toBe('ok')
      expect(count).toBe(2)
    })

    it('prevents a slow expired leader from overwriting a newer response', async () => {
      vi.useFakeTimers()
      const app = new Hono()
      let count = 0
      let release: (() => void) | undefined
      const gate = new Promise<void>((resolve) => {
        release = resolve
      })

      app.get('/items', cacheMiddleware({ maxAge: 60 }), async (c) => {
        count += 1
        if (count === 1) {
          await gate
          return c.text('old')
        }
        return c.text('new')
      })

      const oldRequest = app.request('http://localhost/items')
      await vi.waitFor(() => {
        expect(count).toBe(1)
      })
      await vi.advanceTimersByTimeAsync(5100)
      expect(await (await app.request('http://localhost/items')).text()).toBe('new')
      release?.()
      expect(await (await oldRequest).text()).toBe('old')
      await flushPromises()
      expect(await (await app.request('http://localhost/items')).text()).toBe('new')
    })

    it('orders delayed persistence so the newest response wins', async () => {
      vi.useFakeTimers()
      const storage = createCacheStorage()
      const originalSetItem = storage.setItem.bind(storage)
      let release: (() => void) | undefined
      const gate = new Promise<void>((resolve) => {
        release = resolve
      })
      let writes = 0
      vi.spyOn(storage, 'setItem').mockImplementation(async (...args) => {
        writes += 1
        if (writes === 1) {
          await gate
        }
        await originalSetItem(...args)
      })
      const app = new Hono()
      let count = 0
      app.get('/items', cacheMiddleware({ maxAge: 60, storage }), (c) =>
        c.text(count++ === 0 ? 'old' : 'new')
      )

      expect(await (await app.request('http://localhost/items')).text()).toBe('old')
      await vi.advanceTimersByTimeAsync(5100)
      expect(await (await app.request('http://localhost/items')).text()).toBe('new')
      release?.()
      await vi.waitFor(() => {
        expect(writes).toBe(2)
      })
      expect(await (await app.request('http://localhost/items')).text()).toBe('new')
    })

    it('prevents manual revalidation from being overwritten by an older fill', async () => {
      const app = new Hono()
      let count = 0
      let release: (() => void) | undefined
      const gate = new Promise<void>((resolve) => {
        release = resolve
      })
      app.get(
        '/items',
        cacheMiddleware({
          maxAge: 60,
          revalidateHeader: 'x-revalidate',
          shouldRevalidate: () => true,
        }),
        async (c) => {
          count += 1
          if (count === 1) {
            await gate
            return c.text('old')
          }
          return c.text('new')
        }
      )

      const oldRequest = app.request('http://localhost/items')
      await vi.waitFor(() => {
        expect(count).toBe(1)
      })
      expect(
        await (
          await app.request('http://localhost/items', {
            headers: { 'x-revalidate': '1' },
          })
        ).text()
      ).toBe('new')
      release?.()
      expect(await (await oldRequest).text()).toBe('old')
      await flushPromises()
      expect(await (await app.request('http://localhost/items')).text()).toBe('new')
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

    it('includes request bodies in default keys for custom methods', async () => {
      const app = new Hono()
      let count = 0

      app.post('/items', cacheMiddleware({ maxAge: 60, methods: ['POST'] }), async (c) => {
        count += 1
        return c.text(`${await c.req.text()}:${count}`)
      })

      const request = (body: string) =>
        app.request('http://localhost/items', { body, method: 'POST' })

      expect(await (await request('one')).text()).toBe('one:1')
      expect(await (await request('two')).text()).toBe('two:2')
      expect(await (await request('one')).text()).toBe('one:1')
      expect(count).toBe(2)
    })

    it('refreshes expired custom methods synchronously', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))

      const app = new Hono()
      let count = 0
      app.post(
        '/items',
        cacheMiddleware({ maxAge: 1, methods: ['POST'], staleMaxAge: 60 }),
        async (c) => {
          count += 1
          return c.text(`${await c.req.text()}:${count}`)
        }
      )

      const request = () => app.request('http://localhost/items', { body: 'one', method: 'POST' })

      expect(await (await request()).text()).toBe('one:1')
      vi.advanceTimersByTime(1100)
      expect(await (await request()).text()).toBe('one:2')
      expect(await (await request()).text()).toBe('one:2')
      expect(count).toBe(2)
    })

    it('respects shouldBypassCache', async () => {
      const app = new Hono()
      let count = 0

      app.get(
        '/items',
        cacheMiddleware({
          maxAge: 60,
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

    it.each([
      ['range', 'bytes=0-2'],
      ['if-range', '"v1"'],
      ['if-match', '"v1"'],
      ['if-none-match', '"v1"'],
      ['if-modified-since', 'Wed, 01 Jan 2025 00:00:00 GMT'],
      ['if-unmodified-since', 'Wed, 01 Jan 2025 00:00:00 GMT'],
    ])('bypasses cached responses for %s requests', async (header, value) => {
      const app = new Hono()
      let count = 0

      app.get('/items', cacheMiddleware({ maxAge: 60 }), (c) => {
        count += 1
        return c.text(String(count), c.req.header('range') ? 206 : 200)
      })

      expect(await (await app.request('http://localhost/items')).text()).toBe('1')
      const conditional = await app.request('http://localhost/items', {
        headers: { [header]: value },
      })
      expect(await conditional.text()).toBe('2')
      expect(await (await app.request('http://localhost/items')).text()).toBe('1')
      expect(count).toBe(2)
    })

    it.each([
      ['cache-control', 'no-cache'],
      ['cache-control', 'public, max-age=0'],
      ['cache-control', 'no-store'],
      ['cache-control', 'max-age=00'],
      ['cache-control', 'max-age="0"'],
      ['pragma', 'no-cache'],
      ['pragma', 'foo, no-cache'],
    ])('bypasses cached responses for %s: %s', async (header, value) => {
      const app = new Hono()
      let count = 0

      app.get('/items', cacheMiddleware({ maxAge: 60 }), (c) => {
        count += 1
        return c.text(String(count))
      })

      expect(await (await app.request('http://localhost/items')).text()).toBe('1')
      expect(
        await (await app.request('http://localhost/items', { headers: { [header]: value } })).text()
      ).toBe('2')
      expect(await (await app.request('http://localhost/items')).text()).toBe('1')
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
          keepPreviousOn5xx: true,
          revalidateHeader: 'x-internal-revalidate',
          shouldInvalidateCache: (c) => c.req.header('x-invalidate') === '1',
        }),
        (c) => c.text(value, status as 200 | 500)
      )

      const first = await app.request('http://localhost/items')
      expect(await first.text()).toBe('v1')

      status = 500
      value = 'v2'
      const refresh = await app.request('http://localhost/items', {
        headers: { 'x-invalidate': '1', 'x-internal-revalidate': '1' },
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
          keepPreviousOn5xx: false,
          revalidateHeader: 'x-internal-revalidate',
          shouldInvalidateCache: (c) => c.req.header('x-invalidate') === '1',
        }),
        (c) => c.text(value, status as 200 | 500)
      )

      const first = await app.request('http://localhost/items')
      expect(await first.text()).toBe('v1')

      status = 500
      value = 'v2'
      const refresh = await app.request('http://localhost/items', {
        headers: { 'x-invalidate': '1', 'x-internal-revalidate': '1' },
      })
      expect(refresh.status).toBe(500)

      status = 200
      value = 'v3'
      const fresh = await app.request('http://localhost/items')
      expect(await fresh.text()).toBe('v3')
    })

    it('does not manually revalidate unless revalidateHeader is configured', async () => {
      const app = new Hono()
      let value = 'v1'

      app.get('/items', cacheMiddleware({ maxAge: 60 }), (c) => c.text(value))

      const first = await app.request('http://localhost/items')
      expect(await first.text()).toBe('v1')

      value = 'v2'
      const revalidated = await app.request('http://localhost/items', {
        headers: { 'x-cache-revalidate': '1' },
      })
      const cached = await app.request('http://localhost/items')

      expect(await revalidated.text()).toBe('v1')
      expect(await cached.text()).toBe('v1')
    })

    it('does not trust a spoofed internal revalidation header', async () => {
      const app = new Hono()
      let value = 'v1'

      app.get('/items', cacheMiddleware({ maxAge: 60 }), (c) => c.text(value))

      await app.request('http://localhost/items')
      value = 'v2'

      const spoofed = await app.request('http://localhost/items', {
        headers: { 'x-hono-universal-cache-revalidate': '1' },
      })

      expect(await spoofed.text()).toBe('v1')
      expect(await (await app.request('http://localhost/items')).text()).toBe('v1')
    })

    it('invalidates a fresh response without requiring a revalidation header', async () => {
      const app = new Hono()
      let value = 'v1'
      let invalidate = false

      app.get(
        '/items',
        cacheMiddleware({
          maxAge: 60,
          shouldInvalidateCache: () => invalidate,
        }),
        (c) => c.text(value)
      )

      expect(await (await app.request('http://localhost/items')).text()).toBe('v1')
      value = 'v2'
      invalidate = true
      expect(await (await app.request('http://localhost/items')).text()).toBe('v2')
    })

    it('denies a custom revalidate header without shouldRevalidate', async () => {
      const app = new Hono()
      let value = 'v1'

      app.get(
        '/items',
        cacheMiddleware({
          maxAge: 60,
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

      expect(await cached.text()).toBe('v1')
    })

    it('respects shouldRevalidate for manual revalidation', async () => {
      const app = new Hono()
      let value = 'v1'
      let allowRevalidate = false

      app.get(
        '/items',
        cacheMiddleware({
          maxAge: 60,
          revalidateHeader: 'x-custom-revalidate',
          shouldRevalidate: () => allowRevalidate,
        }),
        (c) => c.text(value)
      )

      await app.request('http://localhost/items')

      value = 'v2'
      const blocked = await app.request('http://localhost/items', {
        headers: { 'x-custom-revalidate': '1' },
      })
      expect(await blocked.text()).toBe('v1')

      allowRevalidate = true
      await app.request('http://localhost/items', {
        headers: { 'x-custom-revalidate': '1' },
      })
      const cached = await app.request('http://localhost/items')

      expect(await cached.text()).toBe('v2')
    })

    it('allows manual revalidation with a dedicated gate header', async () => {
      const app = new Hono()
      let value = 'v1'
      let checks = 0

      app.get(
        '/items',
        cacheMiddleware({
          maxAge: 60,
          revalidateHeader: 'x-cache-revalidate',
          shouldRevalidate: (c) => {
            checks += 1
            return c.req.header('x-cache-token') === 'secret'
          },
        }),
        (c) => c.text(value)
      )

      expect(await (await app.request('http://localhost/items')).text()).toBe('v1')
      value = 'v2'
      expect(
        await (
          await app.request('http://localhost/items', {
            headers: {
              'x-cache-token': 'secret',
              'x-cache-revalidate': '1',
            },
          })
        ).text()
      ).toBe('v2')
      expect(checks).toBe(1)
      expect(await (await app.request('http://localhost/items')).text()).toBe('v2')
    })

    it('does not let credentialed revalidation poison a public cache key', async () => {
      const app = new Hono()
      let count = 0

      app.get(
        '/profile',
        cacheMiddleware({
          maxAge: 60,
          revalidateHeader: 'x-cache-revalidate',
          shouldRevalidate: () => true,
        }),
        (c) => {
          count += 1
          return c.text(c.req.header('authorization') ? 'private' : 'public')
        }
      )

      expect(await (await app.request('http://localhost/profile')).text()).toBe('public')
      expect(
        await (
          await app.request('http://localhost/profile', {
            headers: {
              authorization: 'Bearer secret',
              'x-cache-revalidate': '1',
            },
          })
        ).text()
      ).toBe('private')
      expect(await (await app.request('http://localhost/profile')).text()).toBe('public')
      expect(count).toBe(2)
    })

    it('applies defaults from cacheDefaults()', async () => {
      const app = new Hono()
      let count = 0

      app.use('*', cacheDefaults({ maxAge: 60 }))
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

    it('keys by varies headers', async () => {
      const app = new Hono()
      let count = 0

      app.get(
        '/items',
        cacheMiddleware({
          maxAge: 60,
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

    it('separates default cache keys by origin and method', async () => {
      const app = new Hono()
      let count = 0

      app.on(
        ['GET', 'POST'],
        '/items',
        cacheMiddleware({ maxAge: 60, methods: ['GET', 'POST'] }),
        (c) => {
          count += 1
          return c.text(`${c.req.method}:${new URL(c.req.url).host}:${count}`)
        }
      )

      expect(await (await app.request('http://one.example/items')).text()).toBe('GET:one.example:1')
      expect(await (await app.request('http://two.example/items')).text()).toBe('GET:two.example:2')
      expect(await (await app.request('http://one.example/items', { method: 'POST' })).text()).toBe(
        'POST:one.example:3'
      )
      expect(await (await app.request('http://one.example/items')).text()).toBe('GET:one.example:1')
    })

    it.each([
      ['user?one', 'user?two'],
      ['a/b', 'a:b'],
      ['a\\b', 'a:b'],
    ])('keeps normalized custom keys %s and %s isolated', async (firstKey, secondKey) => {
      const app = new Hono()
      let count = 0

      app.get(
        '/items',
        cacheMiddleware({
          getKey: (c) => c.req.header('x-key') ?? '',
          maxAge: 60,
        }),
        (c) => {
          count += 1
          return c.text(`${c.req.header('x-key')}:${count}`)
        }
      )

      const request = (key: string) =>
        app.request('http://localhost/items', { headers: { 'x-key': key } })

      expect(await (await request(firstKey)).text()).toBe(`${firstKey}:1`)
      expect(await (await request(secondKey)).text()).toBe(`${secondKey}:2`)
      expect(await (await request(firstKey)).text()).toBe(`${firstKey}:1`)
      expect(await (await request(secondKey)).text()).toBe(`${secondKey}:2`)
      expect(count).toBe(2)
    })

    it('keeps legal Vary header names isolated', async () => {
      const storage = createCacheStorage()
      const first = new Hono()
      const second = new Hono()
      let firstCalls = 0
      let secondCalls = 0

      first.get(
        '/items',
        cacheMiddleware({ maxAge: 60, name: 'shared', storage, varies: ['x-a'] }),
        (c) => {
          firstCalls += 1
          c.header('vary', 'x-a')
          return c.text(`first:${c.req.header('x-a')}`)
        }
      )
      second.get(
        '/items',
        cacheMiddleware({ maxAge: 60, name: 'shared', storage, varies: ['xa'] }),
        (c) => {
          secondCalls += 1
          c.header('vary', 'xa')
          return c.text(`second:${c.req.header('xa')}`)
        }
      )

      expect(
        await (await first.request('http://localhost/items', { headers: { 'x-a': 'same' } })).text()
      ).toBe('first:same')
      expect(
        await (await second.request('http://localhost/items', { headers: { xa: 'same' } })).text()
      ).toBe('second:same')
      expect(firstCalls).toBe(1)
      expect(secondCalls).toBe(1)
    })

    it.each(['authorization', 'cookie'])(
      'does not cache requests with an implicit %s header',
      async (header) => {
        const app = new Hono()
        let count = 0

        app.get('/items', cacheMiddleware({ maxAge: 60 }), (c) => {
          count += 1
          return c.text(`${c.req.header(header)}:${count}`)
        })

        const request = (value: string) =>
          app.request('http://localhost/items', { headers: { [header]: value } })

        expect(await (await request('one')).text()).toBe('one:1')
        expect(await (await request('one')).text()).toBe('one:2')
        expect(count).toBe(2)
      }
    )

    it.each(['authorization', 'cookie'])(
      'caches requests when %s is explicitly included in varies',
      async (header) => {
        const app = new Hono()
        let count = 0

        app.get('/items', cacheMiddleware({ maxAge: 60, varies: [header] }), (c) => {
          count += 1
          return c.text(`${c.req.header(header)}:${count}`)
        })

        const request = (value: string) =>
          app.request('http://localhost/items', { headers: { [header]: value } })

        expect(await (await request('one')).text()).toBe('one:1')
        expect(await (await request('two')).text()).toBe('two:2')
        expect(await (await request('one')).text()).toBe('one:1')
        expect(count).toBe(2)
      }
    )

    it('refreshes stale responses synchronously', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))

      const app = new Hono()
      let count = 0
      app.get(
        '/items',
        cacheMiddleware({
          maxAge: 1,
          staleMaxAge: 60,
          getKey: () => 'stable-key',
        }),
        (c) => {
          count += 1
          return c.text(String(count))
        }
      )

      const first = await app.request('http://localhost/items')
      expect(await first.text()).toBe('1')

      vi.advanceTimersByTime(1100)

      expect(await (await app.request('http://localhost/items')).text()).toBe('2')
      expect(await (await app.request('http://localhost/items')).text()).toBe('2')
      expect(count).toBe(2)
    })

    it('serves a stale response when synchronous refresh returns 5xx', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
      const app = new Hono()
      let fail = false

      app.get('/items', cacheMiddleware({ maxAge: 1, staleMaxAge: 60 }), (c) => {
        return fail ? c.text('failed', 500) : c.text('cached')
      })

      expect(await (await app.request('http://localhost/items')).text()).toBe('cached')
      vi.advanceTimersByTime(1100)
      fail = true

      const fallback = await app.request('http://localhost/items')
      expect(fallback.status).toBe(200)
      expect(await fallback.text()).toBe('cached')
    })

    it('serves a stale response when synchronous refresh throws', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
      const app = new Hono()
      let fail = false

      app.get('/items', cacheMiddleware({ maxAge: 1, staleMaxAge: 60 }), (c) => {
        if (fail) {
          throw new Error('failed')
        }
        return c.text('cached')
      })

      expect(await (await app.request('http://localhost/items')).text()).toBe('cached')
      vi.advanceTimersByTime(1100)
      fail = true

      const fallback = await app.request('http://localhost/items')
      expect(fallback.status).toBe(200)
      expect(await fallback.text()).toBe('cached')
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

    it.each([
      'text/event-stream; charset=utf-8',
      'application/x-ndjson',
      'application/ndjson',
      'application/json-seq',
      'application/stream+json',
      'multipart/x-mixed-replace; boundary=frame',
    ])('does not cache streaming responses with content type %s', async (contentType) => {
      const app = new Hono()
      let count = 0

      app.get('/events', cacheMiddleware({ maxAge: 60 }), () => {
        count += 1
        const body = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(`data: ${count}\n\n`))
          },
        })
        return new Response(body, {
          headers: { 'content-type': contentType },
        })
      })

      const first = await app.request('http://localhost/events')
      const second = await app.request('http://localhost/events')
      await first.body?.cancel()
      await second.body?.cancel()

      expect(count).toBe(2)
    })

    it('returns unknown streaming responses without waiting for cache serialization', async () => {
      vi.useFakeTimers()
      const app = new Hono()
      let count = 0

      app.get('/stream', cacheMiddleware({ maxAge: 60 }), () => {
        count += 1
        return new Response(new ReadableStream({}), {
          headers: { 'content-type': 'application/octet-stream' },
        })
      })

      const response = await app.request('http://localhost/stream')
      expect(response.status).toBe(200)
      expect(count).toBe(1)
      void response.body?.cancel()

      await vi.advanceTimersByTimeAsync(1100)
      const next = await app.request('http://localhost/stream')
      expect(count).toBe(2)
      void next.body?.cancel()
    })

    it('cancels the private cache branch after an unknown stream exceeds its limit', async () => {
      let cancelled = 0
      const app = new Hono()
      app.get('/stream', cacheMiddleware({ maxAge: 60 }), () => {
        const stream = new ReadableStream<Uint8Array>({
          async pull(controller) {
            await new Promise((resolve) => setTimeout(resolve, 10))
            controller.enqueue(new Uint8Array(1024 * 1024))
          },
          cancel() {
            cancelled += 1
          },
        })
        return new Response(stream, { headers: { 'content-type': 'application/octet-stream' } })
      })

      const response = await app.request('http://localhost/stream')
      await response.body?.cancel()
      expect(cancelled).toBe(1)
    })

    it('preserves Content-Length on cached HEAD responses', async () => {
      const app = new Hono()
      let count = 0
      app.get('/items', cacheMiddleware({ maxAge: 60 }), () => {
        count += 1
        return new Response('content', { headers: { 'content-length': '7' } })
      })

      const first = await app.request('http://localhost/items', { method: 'HEAD' })
      const second = await app.request('http://localhost/items', { method: 'HEAD' })
      expect(first.headers.get('content-length')).toBe('7')
      expect(second.headers.get('content-length')).toBe('7')
      expect(count).toBe(1)
    })

    it('expires coalescing state when response persistence never settles', async () => {
      vi.useFakeTimers()
      const app = new Hono()
      let count = 0

      app.get(
        '/items',
        cacheMiddleware({
          maxAge: 60,
          serialize: () => new Promise<never>(() => undefined),
        }),
        (c) => c.text(String(++count))
      )

      expect(await (await app.request('http://localhost/items')).text()).toBe('1')
      await vi.advanceTimersByTimeAsync(5100)
      expect(await (await app.request('http://localhost/items')).text()).toBe('2')
    })

    it('adds resident time to Age on cached responses', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
      const app = new Hono()

      app.get('/items', cacheMiddleware({ maxAge: 60 }), () => {
        return new Response('value', { headers: { age: '10' } })
      })

      const first = await app.request('http://localhost/items')
      expect(first.headers.get('age')).toBe('10')
      await flushPromises()
      vi.advanceTimersByTime(2500)
      const cached = await app.request('http://localhost/items')
      expect(cached.headers.get('age')).toBe('12')
    })

    it('includes apparent response age from Date', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-01-01T00:00:30.000Z'))
      const app = new Hono()

      app.get('/items', cacheMiddleware({ maxAge: 60 }), () => {
        return new Response('value', {
          headers: { date: 'Thu, 01 Jan 2026 00:00:00 GMT' },
        })
      })

      await app.request('http://localhost/items')
      await flushPromises()
      expect((await app.request('http://localhost/items')).headers.get('age')).toBe('30')
    })

    it('sanitizes unsafe headers from persisted responses', async () => {
      const storage = createCacheStorage()
      const storageKey = createTestStorageKey('cache', 'hono/handlers', 'items', 'key')
      await storage.setItem(storageKey, {
        value: toBase64('cached'),
        encoding: 'base64',
        status: 200,
        headers: {
          connection: 'keep-alive, x-hop',
          'set-cookie': 'session=attacker',
          'x-safe': 'yes',
          'x-hop': 'attacker',
        },
        mtime: Date.now(),
        expires: Date.now() + 60_000,
        staleExpires: Date.now() + 60_000,
        integrity: 'integrity',
      })
      const app = new Hono()
      app.get(
        '/items',
        cacheMiddleware({
          getKey: () => 'key',
          integrity: 'integrity',
          maxAge: 60,
          name: 'items',
          storage,
        }),
        (c) => c.text('origin')
      )

      const response = await app.request('http://localhost/items')
      expect(await response.text()).toBe('cached')
      expect(response.headers.get('set-cookie')).toBeNull()
      expect(response.headers.get('connection')).toBeNull()
      expect(response.headers.get('x-hop')).toBeNull()
      expect(response.headers.get('x-safe')).toBe('yes')
    })

    it('does not cache responses with unkeyed Vary headers', async () => {
      const app = new Hono()
      let count = 0

      app.get('/items', cacheMiddleware({ maxAge: 60 }), (c) => {
        count += 1
        c.header('vary', 'Accept-Language, Accept-Encoding')
        return c.text(String(count))
      })

      expect(await (await app.request('http://localhost/items')).text()).toBe('1')
      expect(await (await app.request('http://localhost/items')).text()).toBe('2')
    })

    it('caches responses when every Vary header is keyed', async () => {
      const app = new Hono()
      let count = 0

      app.get(
        '/items',
        cacheMiddleware({ maxAge: 60, varies: ['accept-language', 'accept-encoding'] }),
        (c) => {
          count += 1
          c.header('vary', 'Accept-Language, Accept-Encoding')
          return c.text(String(count))
        }
      )

      const headers = { 'accept-encoding': 'gzip', 'accept-language': 'en' }
      expect(await (await app.request('http://localhost/items', { headers })).text()).toBe('1')
      expect(await (await app.request('http://localhost/items', { headers })).text()).toBe('1')
      expect(count).toBe(1)
    })

    it('fails open when response storage reads and writes fail', async () => {
      const storage = createCacheStorage()
      vi.spyOn(storage, 'getItem').mockRejectedValue(new Error('read unavailable'))
      vi.spyOn(storage, 'setItem').mockRejectedValue(new Error('write unavailable'))
      const app = new Hono()
      let count = 0

      app.get('/items', cacheMiddleware({ maxAge: 60, storage }), (c) => {
        count += 1
        return c.text(String(count))
      })

      expect(await (await app.request('http://localhost/items')).text()).toBe('1')
      expect(await (await app.request('http://localhost/items')).text()).toBe('2')
    })

    it('fails open when response storage removal fails', async () => {
      const storage = createCacheStorage()
      const app = new Hono()
      let invalidate = false
      let count = 0

      app.get(
        '/items',
        cacheMiddleware({
          keepPreviousOn5xx: false,
          maxAge: 60,
          shouldInvalidateCache: () => invalidate,
          storage,
        }),
        (c) => {
          count += 1
          return c.text(String(count))
        }
      )

      expect(await (await app.request('http://localhost/items')).text()).toBe('1')
      vi.spyOn(storage, 'removeItem').mockRejectedValue(new Error('remove unavailable'))
      invalidate = true
      expect(await (await app.request('http://localhost/items')).text()).toBe('2')
    })

    it.each([204, 205])('replays cached %i responses without a body', async (status) => {
      const app = new Hono()
      let count = 0

      app.get('/items', cacheMiddleware({ maxAge: 60 }), () => {
        count += 1
        return new Response(null, { headers: { 'x-count': String(count) }, status })
      })

      const first = await app.request('http://localhost/items')
      const cached = await app.request('http://localhost/items')

      expect(first.status).toBe(status)
      expect(cached.status).toBe(status)
      expect(cached.headers.get('x-count')).toBe('1')
      expect(await cached.text()).toBe('')
      expect(count).toBe(1)
    })

    it.each([
      ['private responses', { 'cache-control': 'private' }, 200],
      ['wildcard vary responses', { vary: '*' }, 200],
      ['partial responses', {}, 206],
    ])('does not cache %s', async (_name, headers, status) => {
      const app = new Hono()
      let count = 0

      app.get('/items', cacheMiddleware({ maxAge: 60 }), () => {
        count += 1
        return new Response(String(count), { headers, status })
      })

      expect(await (await app.request('http://localhost/items')).text()).toBe('1')
      expect(await (await app.request('http://localhost/items')).text()).toBe('2')
    })

    it('supports custom serialize/deserialize for responses', async () => {
      const app = new Hono()
      let count = 0

      app.get(
        '/items',
        cacheMiddleware({
          maxAge: 60,
          serialize: async (response, context) => ({
            value: await response.text(),
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
      const storageKey = createTestStorageKey(base, group, name, key)

      await storage.setItem(storageKey, { value: 1 })

      app.get(
        '/items',
        cacheMiddleware({
          storage,
          name,
          getKey: () => key,
          maxAge: 60,
        }),
        (c) => {
          count += 1
          return c.text(`value-${count}`)
        }
      )

      const res = await app.request('http://localhost/items')
      await vi.waitFor(async () => {
        expect(await storage.getItem(storageKey)).not.toBeNull()
      })
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

    it('does not serve persisted responses with missing cache metadata', async () => {
      const storage = createCacheStorage()
      const storageKey = createTestStorageKey('cache', 'hono/handlers', 'items', 'key')
      await storage.setItem(storageKey, {
        value: toBase64('poison'),
        encoding: 'base64',
        status: 200,
        headers: {},
        integrity: 'integrity',
      })
      const app = new Hono()
      let count = 0
      app.get(
        '/items',
        cacheMiddleware({
          getKey: () => 'key',
          integrity: 'integrity',
          maxAge: 60,
          name: 'items',
          storage,
        }),
        (c) => {
          count += 1
          return c.text('origin')
        }
      )

      expect(await (await app.request('http://localhost/items')).text()).toBe('origin')
      expect(count).toBe(1)
    })

    it('removes persisted responses after their stale window', async () => {
      const storage = createCacheStorage()
      const storageKey = createTestStorageKey('cache', 'hono/handlers', 'items', 'key')
      await storage.setItem(storageKey, {
        value: toBase64('expired'),
        encoding: 'base64',
        status: 200,
        headers: {},
        mtime: Date.now() - 3000,
        expires: Date.now() - 2000,
        staleExpires: Date.now() - 1000,
        integrity: 'integrity',
      })
      const app = new Hono()
      app.onError(() => new Response('failed', { status: 500 }))
      app.get(
        '/items',
        cacheMiddleware({
          getKey: () => 'key',
          integrity: 'integrity',
          maxAge: 60,
          name: 'items',
          storage,
        }),
        () => {
          throw new Error('origin failed')
        }
      )

      expect((await app.request('http://localhost/items')).status).toBe(500)
      expect(await storage.getItem(storageKey)).toBeNull()
    })

    it('falls back to safe key prefix when path decoding fails', async () => {
      const app = new Hono()
      let count = 0

      app.get('*', cacheMiddleware({ maxAge: 60 }), (c) => {
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

      const storageKey = createTestStorageKey('cache', 'hono/handlers', 'items', 'key')
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

      const storageKey = createTestStorageKey('cache', 'hono/handlers', 'items', 'key')
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

    it('evicts old cache when invalidated response is non-cacheable with keepPreviousOn5xx=true', async () => {
      const app = new Hono()
      let value = 'v1'
      let noStore = false

      app.get(
        '/items',
        cacheMiddleware({
          maxAge: 60,
          keepPreviousOn5xx: true,
          revalidateHeader: 'x-internal-revalidate',
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
        headers: { 'x-internal-revalidate': '1', 'x-invalidate': '1' },
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

    it('caches null function results', async () => {
      let count = 0
      const fn = cacheFunction(
        () => {
          count += 1
          return null
        },
        { maxAge: 60, swr: false }
      )

      expect(await fn()).toBeNull()
      expect(await fn()).toBeNull()
      expect(count).toBe(1)
    })

    it('invalidates a fresh function result', async () => {
      let count = 0
      let invalidate = false
      const fn = cacheFunction(
        () => {
          count += 1
          return count
        },
        {
          maxAge: 60,
          swr: false,
          shouldInvalidateCache: () => invalidate,
        }
      )

      expect(await fn()).toBe(1)
      invalidate = true
      expect(await fn()).toBe(2)
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

    it('deduplicates concurrent calls across wrappers sharing an explicit identity', async () => {
      const storage = createCacheStorage()
      let count = 0
      let release: (() => void) | undefined
      const gate = new Promise<void>((resolve) => {
        release = resolve
      })
      const fetcher = async () => {
        count += 1
        await gate
        return count
      }
      const first = cacheFunction(fetcher, { maxAge: 60, name: 'shared', storage })
      const second = cacheFunction(fetcher, { maxAge: 60, name: 'shared', storage })

      const pending = [first(), second()]
      await vi.waitFor(() => {
        expect(count).toBe(1)
      })
      release?.()

      expect(await Promise.all(pending)).toEqual([1, 1])
      expect(count).toBe(1)
    })

    it('does not deduplicate calls across storage instances', async () => {
      let count = 0
      let resolveFirst!: () => void
      const firstCall = new Promise<void>((resolve) => {
        resolveFirst = resolve
      })
      const fetcher = async () => {
        count += 1
        const current = count
        if (current === 1) {
          await firstCall
        }
        return current
      }
      const options = {
        getKey: () => 'key',
        maxAge: 60,
        swr: false,
      }
      const first = cacheFunction(fetcher, { ...options, storage: createCacheStorage() })
      const second = cacheFunction(fetcher, { ...options, storage: createCacheStorage() })

      const firstResult = first()
      const secondResult = second()
      expect(await secondResult).toBe(2)
      resolveFirst()
      expect(await firstResult).toBe(1)
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

    it('handles rejected background function refreshes while serving stale', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))

      let shouldThrow = false
      const fn = cacheFunction(
        () => {
          if (shouldThrow) {
            throw new Error('refresh failed')
          }
          return 'cached'
        },
        { maxAge: 1, staleMaxAge: 60, swr: true }
      )

      expect(await fn()).toBe('cached')
      shouldThrow = true
      vi.advanceTimersByTime(1100)
      expect(await fn()).toBe('cached')
      await flushPromises()
    })

    it('coalesces concurrent synchronous function failures', async () => {
      let count = 0
      const fn = cacheFunction(
        () => {
          count += 1
          throw new Error('failed')
        },
        { maxAge: 60, swr: false }
      )

      const results = await Promise.allSettled(Array.from({ length: 500 }, () => fn()))
      expect(results.every((result) => result.status === 'rejected')).toBe(true)
      expect(count).toBe(1)
      await flushPromises()
      await expect(fn()).rejects.toThrow('failed')
      expect(count).toBe(2)
    })

    it('prevents a slow expired function call from overwriting a newer result', async () => {
      vi.useFakeTimers()
      let count = 0
      let release: (() => void) | undefined
      const gate = new Promise<void>((resolve) => {
        release = resolve
      })
      const fn = cacheFunction(
        async () => {
          count += 1
          if (count === 1) {
            await gate
            return 'old'
          }
          return 'new'
        },
        { maxAge: 60, name: 'ordered-function', swr: false }
      )

      const oldCall = fn()
      await vi.waitFor(() => {
        expect(count).toBe(1)
      })
      await vi.advanceTimersByTimeAsync(5100)
      expect(await fn()).toBe('new')
      release?.()
      expect(await oldCall).toBe('old')
      await flushPromises()
      expect(await fn()).toBe('new')
    })

    it('keeps empty function cache-key segments isolated', async () => {
      const storage = createCacheStorage()
      let secondCalls = 0
      const first = cacheFunction(() => 'first', {
        base: 'base',
        getKey: () => 'key',
        group: 'group',
        maxAge: 60,
        name: '',
        storage,
      })
      const second = cacheFunction(
        () => {
          secondCalls += 1
          return 'second'
        },
        {
          base: 'base',
          getKey: () => '',
          group: 'group',
          maxAge: 60,
          name: 'key',
          storage,
        }
      )

      expect(await first()).toBe('first')
      expect(await second()).toBe('second')
      expect(secondCalls).toBe(1)
      expect((await storage.getKeys()).sort()).toEqual([
        'base:group:%00:key.json',
        'base:group:key:%00.json',
      ])
    })

    it.each([
      ['NaN', () => Number.NaN],
      ['Infinity', () => Number.POSITIVE_INFINITY],
      ['negative zero', () => -0],
      ['Date', () => new Date('2026-01-01T00:00:00.000Z')],
      ['Map', () => new Map([['key', 'value']])],
    ])('does not persist JSON-unsafe %s function results', async (_name, createValue) => {
      let count = 0
      const fn = cacheFunction(
        () => {
          count += 1
          return createValue()
        },
        { maxAge: 60, swr: false }
      )

      const first = await fn()
      await flushPromises()
      const second = await fn()
      expect(Object.prototype.toString.call(second)).toBe(Object.prototype.toString.call(first))
      if (typeof first === 'number') {
        expect(Object.is(second, first)).toBe(true)
      }
      expect(count).toBe(2)
    })

    it('fails open when persisted function metadata getters throw', async () => {
      const storage = createCacheStorage()
      vi.spyOn(storage, 'getItem').mockResolvedValue(
        new Proxy(
          {},
          {
            get() {
              throw new Error('hostile record')
            },
          }
        )
      )
      let count = 0
      const fn = cacheFunction(() => `origin-${++count}`, {
        getKey: () => 'key',
        maxAge: 60,
        storage,
        swr: false,
      })

      expect(await fn()).toBe('origin-1')
    })

    it('fails open after a storage read timeout', async () => {
      vi.useFakeTimers()
      const storage = createCacheStorage()
      vi.spyOn(storage, 'getItem').mockReturnValue(new Promise<never>(() => undefined))
      let count = 0
      const fn = cacheFunction(() => `origin-${++count}`, {
        getKey: () => 'key',
        maxAge: 60,
        storage,
        swr: false,
      })

      const result = fn()
      await vi.advanceTimersByTimeAsync(5100)
      expect(await result).toBe('origin-1')
    })

    it('does not block fresh function results on a hung cache write', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
      const storage = createCacheStorage()
      let count = 0
      const fn = cacheFunction(() => `v${++count}`, {
        getKey: () => 'key',
        maxAge: 1,
        staleMaxAge: 1,
        storage,
        swr: true,
      })

      expect(await fn()).toBe('v1')
      await vi.waitFor(async () => {
        expect((await storage.getKeys()).length).toBe(1)
      })
      vi.spyOn(storage, 'setItem').mockReturnValue(new Promise(() => undefined))
      vi.advanceTimersByTime(1100)
      expect(await fn()).toBe('v1')
      await flushPromises()
      expect(count).toBe(2)
      vi.advanceTimersByTime(1100)
      expect(await fn()).toBe('v2')
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

    it('isolates wrappers created from the same closure source', async () => {
      const storage = createCacheStorage()
      const makeCached = (value: string) => cacheFunction(() => value, { maxAge: 60, storage })
      const first = makeCached('tenant-a')
      const second = makeCached('tenant-b')

      expect(await first()).toBe('tenant-a')
      expect(await second()).toBe('tenant-b')
      expect(await first()).toBe('tenant-a')
      expect(await second()).toBe('tenant-b')
    })

    it('keeps zero and negative zero argument keys isolated', async () => {
      let count = 0
      const fn = cacheFunction(
        (value: number) => {
          count += 1
          return Object.is(value, -0) ? 'negative' : 'positive'
        },
        { maxAge: 60 }
      )

      expect(await fn(0)).toBe('positive')
      expect(await fn(-0)).toBe('negative')
      expect(count).toBe(2)
    })

    it.each([
      [new Date('2026-01-01T00:00:00.000Z'), '2026-01-01T00:00:00.000Z'],
      [Number.NaN, null],
    ])('keeps type-distinct arguments isolated', async (firstArg, secondArg) => {
      let count = 0
      const fn = cacheFunction(
        (value: unknown) => {
          count += 1
          return `${String(value)}:${count}`
        },
        { maxAge: 60, swr: false }
      )

      expect(await fn(firstArg)).toBe(`${String(firstArg)}:1`)
      expect(await fn(secondArg)).toBe(`${String(secondArg)}:2`)
      expect(await fn(firstArg)).toBe(`${String(firstArg)}:1`)
      expect(count).toBe(2)
    })

    it('removes malformed function cache entries before computing fresh value', async () => {
      const storage = createCacheStorage()
      let count = 0

      await storage.setItem(
        createTestStorageKey('cache', 'hono/functions', 'fn', 'key'),
        123 as unknown as object
      )

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

    it('does not serve function entries with missing cache metadata', async () => {
      const storage = createCacheStorage()
      const storageKey = createTestStorageKey('cache', 'hono/functions', 'fn', 'key')
      await storage.setItem(storageKey, { value: 'poison', integrity: 'integrity' })
      let count = 0
      const fn = cacheFunction(
        () => {
          count += 1
          return 'origin'
        },
        {
          getKey: () => 'key',
          integrity: 'integrity',
          maxAge: 60,
          name: 'fn',
          storage,
        }
      )

      expect(await fn()).toBe('origin')
      expect(count).toBe(1)
    })

    it('removes function entries after their stale window', async () => {
      const storage = createCacheStorage()
      const storageKey = createTestStorageKey('cache', 'hono/functions', 'fn', 'key')
      await storage.setItem(storageKey, {
        value: 'expired',
        mtime: Date.now() - 3000,
        expires: Date.now() - 2000,
        staleExpires: Date.now() - 1000,
        integrity: 'integrity',
      })
      const fn = cacheFunction(
        () => {
          throw new Error('origin failed')
        },
        {
          getKey: () => 'key',
          integrity: 'integrity',
          maxAge: 60,
          name: 'fn',
          storage,
        }
      )

      await expect(fn()).rejects.toThrow('origin failed')
      expect(await storage.getItem(storageKey)).toBeNull()
    })

    it('fails open when function storage reads and writes fail', async () => {
      const storage = createCacheStorage()
      vi.spyOn(storage, 'getItem').mockRejectedValue(new Error('read unavailable'))
      vi.spyOn(storage, 'setItem').mockRejectedValue(new Error('write unavailable'))
      let count = 0

      const fn = cacheFunction(() => ++count, { maxAge: 60, storage })

      expect(await fn()).toBe(1)
      expect(await fn()).toBe(2)
    })

    it('resolves global defaults when the cached function is called', async () => {
      let count = 0
      const fn = cacheFunction(() => ++count)

      setCacheDefaults({ maxAge: 0 })
      expect(await fn()).toBe(1)
      expect(await fn()).toBe(2)

      setCacheDefaults({ maxAge: 60 })
      expect(await fn()).toBe(3)
      expect(await fn()).toBe(3)
    })
  })

  describe('global cache accessors', () => {
    it('exports stableStringify for deterministic custom keys', () => {
      expect(stableStringify({ b: 2, a: 1 })).toBe(stableStringify({ a: 1, b: 2 }))
    })

    it('sets and gets global cache defaults and storage', () => {
      const storage = createCacheStorage()

      setCacheStorage(storage)
      setCacheDefaults({ maxAge: 120 })
      const defaults = getCacheDefaults()
      defaults.maxAge = 1

      expect(getCacheStorage()).toBe(storage)
      expect(getCacheDefaults()).toEqual({ maxAge: 120 })

      setCacheDefaults({ staleMaxAge: 30 })
      expect(getCacheDefaults()).toEqual({ staleMaxAge: 30 })
      setCacheDefaults({})
      expect(getCacheDefaults()).toEqual({})
    })

    it('bounds and expires the default memory storage', async () => {
      const storage = createCacheStorage()

      for (let index = 0; index <= 1000; index += 1) {
        await storage.setItem(`key-${index}`, index)
      }

      expect(await storage.getItem('key-0')).toBeNull()
      expect(await storage.getItem('key-1000')).toBe(1000)

      await storage.setItem('expiring', 'value', { ttl: 0.001 })
      await new Promise((resolve) => setTimeout(resolve, 10))
      expect(await storage.getItem('expiring')).toBeNull()

      const smallStorage = createCacheStorage({
        maxEntries: 10,
        maxEntrySize: 10,
        maxSize: 100,
      })
      await smallStorage.setItem('oversized', 'a value larger than ten bytes')
      expect(await smallStorage.getItem('oversized')).toBeNull()
    })
  })
})
