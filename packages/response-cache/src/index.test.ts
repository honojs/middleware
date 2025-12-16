import { Hono } from 'hono'
import { vi } from 'vitest'
import { responseCache } from '.'

const createMockStore = () => {
  const storage = new Map<string, string>()
  return {
    get: vi.fn((key: string) => storage.get(key) ?? null),
    set: vi.fn((key: string, value: string) => {
      storage.set(key, value)
    }),
    invalidate: vi.fn((key: string) => {
      storage.delete(key)
    }),
    storage,
  }
}

describe('Response Cache Middleware', () => {
  describe('Cache Miss', () => {
    it('Should call handler on cache miss', async () => {
      const store = createMockStore()
      const app = new Hono()
      const handlerSpy = vi.fn((c) => c.text('response'))

      app.use('*', responseCache({ store }))
      app.get('/test', handlerSpy)

      await app.request(new Request('http://localhost/test'))

      expect(handlerSpy).toHaveBeenCalledTimes(1)
    })

    it('Should return complete response on cache miss', async () => {
      const store = createMockStore()
      const app = new Hono()

      app.use('*', responseCache({ store }))
      app.get('/test', (c) => c.json({ data: 'test' }, 201, { 'X-Custom': 'header' }))

      const res = await app.request(new Request('http://localhost/test'))

      expect(res.status).toBe(201)
      expect(res.headers.get('X-Custom')).toBe('header')
      expect(res.headers.get('Content-Type')).toContain('application/json')

      const data = await res.json()
      expect(data).toEqual({ data: 'test' })
    })
  })

  describe('Cache Hit', () => {
    it('Should return cached response on second call', async () => {
      const store = createMockStore()
      const app = new Hono()

      app.use('*', responseCache({ store }))
      app.get('/test', (c) => c.json({ data: 'test' }, 200, {
        'X-Request-Id': '12345',
        'Cache-Control': 'max-age=3600',
      }))

      const res1 = await app.request(new Request('http://localhost/test'))
      expect(res1.status).toBe(200)
      expect(res1.headers.get('X-Request-Id')).toBe('12345')
      expect(await res1.json()).toEqual({ data: 'test' })

      store.get.mockClear()
      store.set.mockClear()

      const res2 = await app.request(new Request('http://localhost/test'))

      expect(res2.status).toBe(200)
      expect(res2.headers.get('X-Request-Id')).toBe('12345')
      expect(res2.headers.get('Cache-Control')).toBe('max-age=3600')
      expect(await res2.json()).toEqual({ data: 'test' })
      expect(store.get).toHaveBeenCalledWith('/test')
      expect(store.set).not.toHaveBeenCalled()
    })

    it('Should filter sensitive headers from cache', async () => {
      const store = createMockStore()
      const app = new Hono()

      app.use('*', responseCache({ store }))
      app.get('/test', (c) => {
        return c.json({ data: 'test' }, 200, {
          'Content-Type': 'application/json',
          'X-Custom': 'safe-header',
          'Set-Cookie': 'session=abc123',
          'WWW-Authenticate': 'Bearer token',
        })
      })

      await app.request(new Request('http://localhost/test'))

      const cachedValue = store.storage.get('/test')
      const snapshot = JSON.parse(cachedValue!)

      expect(snapshot.headers['x-custom']).toBe('safe-header')
      expect(snapshot.headers['content-type']).toContain('application/json')
      expect(snapshot.headers['set-cookie']).toBeUndefined()
      expect(snapshot.headers['www-authenticate']).toBeUndefined()
    })
  })

  describe('Response Types', () => {
    it('Should cache JSON responses correctly', async () => {
      const store = createMockStore()
      const app = new Hono()

      app.use('*', responseCache({ store }))
      app.get('/test', (c) => c.json({ message: 'hello', count: 42 }))

      const res1 = await app.request(new Request('http://localhost/test'))
      const data1 = await res1.json()
      expect(data1).toEqual({ message: 'hello', count: 42 })

      const res2 = await app.request(new Request('http://localhost/test'))
      const data2 = await res2.json()
      expect(data2).toEqual({ message: 'hello', count: 42 })
    })

    it('Should cache HTML responses correctly', async () => {
      const store = createMockStore()
      const app = new Hono()

      app.use('*', responseCache({ store }))
      app.get('/test', (c) => c.html('<div>Test</div>'))

      const res1 = await app.request(new Request('http://localhost/test'))
      expect(await res1.text()).toBe('<div>Test</div>')

      const res2 = await app.request(new Request('http://localhost/test'))
      expect(await res2.text()).toBe('<div>Test</div>')
    })

    it('Should cache text responses correctly', async () => {
      const store = createMockStore()
      const app = new Hono()

      app.use('*', responseCache({ store }))
      app.get('/test', (c) => c.text('Plain text response'))

      const res1 = await app.request(new Request('http://localhost/test'))
      expect(await res1.text()).toBe('Plain text response')

      const res2 = await app.request(new Request('http://localhost/test'))
      expect(await res2.text()).toBe('Plain text response')
    })

    it('Should cache body responses correctly', async () => {
      const store = createMockStore()
      const app = new Hono()

      app.use('*', responseCache({ store }))
      app.get('/test', (c) => c.body('Body response'))

      const res1 = await app.request(new Request('http://localhost/test'))
      expect(await res1.text()).toBe('Body response')

      const res2 = await app.request(new Request('http://localhost/test'))
      expect(await res2.text()).toBe('Body response')
    })
  })

  describe('Custom Key Function', () => {
    it('Should use request path as key by default', async () => {
      const store = createMockStore()
      const app = new Hono()

      app.use('*', responseCache({ store }))
      app.get('/test', (c) => c.text('response'))

      await app.request(new Request('http://localhost/test'))

      expect(store.get).toHaveBeenCalledWith('/test')
      expect(store.set).toHaveBeenCalledWith('/test', expect.any(String))
    })

    it('Should use custom keyFn when provided', async () => {
      const store = createMockStore()
      const app = new Hono()
      const customKeyFn = vi.fn((c) => `custom_${c.req.path}`)

      app.use('*', responseCache({ store, keyFn: customKeyFn }))
      app.get('/test', (c) => c.text('response'))

      await app.request(new Request('http://localhost/test'))

      expect(customKeyFn).toHaveBeenCalled()
      expect(store.get).toHaveBeenCalledWith('custom_/test')
      expect(store.set).toHaveBeenCalledWith('custom_/test', expect.any(String))
    })

    it('Should maintain separate cache entries for different keys', async () => {
      const store = createMockStore()
      const app = new Hono()

      app.use('*', responseCache({ store }))
      app.get('/page1', (c) => c.text('Page 1'))
      app.get('/page2', (c) => c.text('Page 2'))

      const res1 = await app.request(new Request('http://localhost/page1'))
      expect(await res1.text()).toBe('Page 1')

      const res2 = await app.request(new Request('http://localhost/page2'))
      expect(await res2.text()).toBe('Page 2')

      expect(store.storage.has('/page1')).toBe(true)
      expect(store.storage.has('/page2')).toBe(true)
      expect(store.storage.get('/page1')).not.toBe(store.storage.get('/page2'))
    })
  })

  describe('Logging', () => {
    it('Should call onHit callback on cache hit', async () => {
      const store = createMockStore()
      const onHit = vi.fn()
      const app = new Hono()

      app.use('*', responseCache({ store, logging: { enabled: true, onHit } }))
      app.get('/test', (c) => c.text('response'))

      await app.request(new Request('http://localhost/test'))
      expect(onHit).not.toHaveBeenCalled()

      await app.request(new Request('http://localhost/test'))
      expect(onHit).toHaveBeenCalledWith('/test', expect.anything())
    })

    it('Should call onMiss callback on cache miss', async () => {
      const store = createMockStore()
      const onMiss = vi.fn()
      const app = new Hono()

      app.use('*', responseCache({ store, logging: { enabled: true, onMiss } }))
      app.get('/test', (c) => c.text('response'))

      await app.request(new Request('http://localhost/test'))

      expect(onMiss).toHaveBeenCalledWith('/test', expect.anything())
    })

    it('Should not call logging callbacks when logging is disabled', async () => {
      const store = createMockStore()
      const onHit = vi.fn()
      const onMiss = vi.fn()
      const app = new Hono()

      app.use('*', responseCache({ store, logging: { enabled: false, onHit, onMiss } }))
      app.get('/test', (c) => c.text('response'))

      await app.request(new Request('http://localhost/test'))
      expect(onMiss).not.toHaveBeenCalled()

      await app.request(new Request('http://localhost/test'))
      expect(onHit).not.toHaveBeenCalled()
    })

    it('Should not call logging callbacks when logging is not provided', async () => {
      const store = createMockStore()
      const app = new Hono()

      app.use('*', responseCache({ store }))
      app.get('/test', (c) => c.text('response'))

      await app.request(new Request('http://localhost/test'))
      await app.request(new Request('http://localhost/test'))
    })

    it('Should pass context to logging callbacks', async () => {
      const store = createMockStore()
      const onHit = vi.fn()
      const app = new Hono()

      app.use('*', responseCache({ store, logging: { enabled: true, onHit } }))
      app.get('/test', (c) => c.text('response'))

      await app.request(new Request('http://localhost/test'))
      await app.request(new Request('http://localhost/test'))

      expect(onHit).toHaveBeenCalledWith(
        '/test',
        expect.objectContaining({
          req: expect.any(Object),
        })
      )
    })
  })

  describe('Error Handling', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
      consoleErrorSpy.mockRestore()
    })

    it('Should call onError callback when store.get throws', async () => {
      const store = createMockStore()
      const onError = vi.fn()
      store.get.mockImplementation(() => {
        throw new Error('Store get error')
      })

      const app = new Hono()
      app.use('*', responseCache({ store, logging: { enabled: true, onError } }))
      app.get('/test', (c) => c.text('response'))

      const res = await app.request(new Request('http://localhost/test'))

      expect(res.status).toBe(500)
      expect(onError).toHaveBeenCalledWith(
        '/test',
        expect.anything(),
        expect.objectContaining({ message: 'Store get error' })
      )
    })

    it('Should call onError callback when store.set throws', async () => {
      const store = createMockStore()
      const onError = vi.fn()
      store.set.mockImplementation(() => {
        throw new Error('Store set error')
      })

      const app = new Hono()
      app.use('*', responseCache({ store, logging: { enabled: true, onError } }))
      app.get('/test', (c) => c.text('response'))

      const res = await app.request(new Request('http://localhost/test'))

      expect(res.status).toBe(500)
      expect(onError).toHaveBeenCalledWith(
        '/test',
        expect.anything(),
        expect.objectContaining({ message: 'Store set error' })
      )
    })
  })

  describe('Integration Tests', () => {
    it('Should work with async store operations', async () => {
      const storage = new Map<string, string>()
      const asyncStore = {
        get: vi.fn(async (key: string) => {
          await new Promise((resolve) => setTimeout(resolve, 10))
          return storage.get(key) ?? null
        }),
        set: vi.fn(async (key: string, value: string) => {
          await new Promise((resolve) => setTimeout(resolve, 10))
          storage.set(key, value)
        }),
        invalidate: vi.fn(async (key: string) => {
          await new Promise((resolve) => setTimeout(resolve, 10))
          storage.delete(key)
        }),
      }

      const app = new Hono()
      app.use('*', responseCache({ store: asyncStore }))
      app.get('/test', (c) => c.text('async response'))

      const res1 = await app.request(new Request('http://localhost/test'))
      expect(await res1.text()).toBe('async response')

      const res2 = await app.request(new Request('http://localhost/test'))
      expect(await res2.text()).toBe('async response')

      expect(asyncStore.get).toHaveBeenCalledTimes(2)
      expect(asyncStore.set).toHaveBeenCalledTimes(1)
    })

    it('Should work with query parameters in custom keyFn', async () => {
      const store = createMockStore()
      const app = new Hono()
      const keyFn = (c: any) => `${c.req.path}?${c.req.query('id')}`

      app.use('*', responseCache({ store, keyFn }))
      app.get('/item', (c) => {
        const id = c.req.query('id')
        return c.text(`Item ${id}`)
      })

      const res1 = await app.request(new Request('http://localhost/item?id=1'))
      const res2 = await app.request(new Request('http://localhost/item?id=2'))

      expect(await res1.text()).toBe('Item 1')
      expect(await res2.text()).toBe('Item 2')

      expect(store.storage.has('/item?1')).toBe(true)
      expect(store.storage.has('/item?2')).toBe(true)
    })
  })
})
