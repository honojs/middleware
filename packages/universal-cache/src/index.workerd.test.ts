import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test'
import { Hono } from 'hono'
import { getRuntimeKey } from 'hono/adapter'
import { cacheMiddleware, createCacheStorage, setCacheStorage } from '.'

describe('@hono/universal-cache workerd', () => {
  beforeEach(() => {
    setCacheStorage(createCacheStorage())
  })

  it('runs in the Cloudflare Workers runtime', () => {
    expect(getRuntimeKey()).toBe('workerd')
  })

  it('does not manually revalidate unless revalidateHeader is configured', async () => {
    const app = new Hono()
    let value = 'v1'
    let count = 0

    app.get('/items', cacheMiddleware({ maxAge: 60, swr: false }), (c) => {
      count += 1
      return c.text(value)
    })

    const ctx1 = createExecutionContext()
    const first = await app.request('http://localhost/items', {}, {}, ctx1)
    await waitOnExecutionContext(ctx1)
    expect(await first.text()).toBe('v1')

    value = 'v2'
    const ctx2 = createExecutionContext()
    const attempted = await app.request(
      'http://localhost/items',
      { headers: { 'x-cache-revalidate': '1' } },
      {},
      ctx2
    )
    await waitOnExecutionContext(ctx2)

    const ctx3 = createExecutionContext()
    const cached = await app.request('http://localhost/items', {}, {}, ctx3)
    await waitOnExecutionContext(ctx3)

    expect(await attempted.text()).toBe('v1')
    expect(await cached.text()).toBe('v1')
    expect(count).toBe(1)
  })

  it('respects shouldRevalidate on workerd', async () => {
    const app = new Hono()
    let value = 'v1'
    let allowRevalidate = false

    app.get(
      '/items',
      cacheMiddleware({
        maxAge: 60,
        swr: false,
        revalidateHeader: 'x-custom-revalidate',
        shouldRevalidate: () => allowRevalidate,
      }),
      (c) => c.text(value)
    )

    const ctx1 = createExecutionContext()
    const first = await app.request('http://localhost/items', {}, {}, ctx1)
    await waitOnExecutionContext(ctx1)
    expect(await first.text()).toBe('v1')

    value = 'v2'
    const ctx2 = createExecutionContext()
    const blocked = await app.request(
      'http://localhost/items',
      { headers: { 'x-custom-revalidate': '1' } },
      {},
      ctx2
    )
    await waitOnExecutionContext(ctx2)
    expect(await blocked.text()).toBe('v1')

    allowRevalidate = true
    const ctx3 = createExecutionContext()
    const revalidated = await app.request(
      'http://localhost/items',
      { headers: { 'x-custom-revalidate': '1' } },
      {},
      ctx3
    )
    await waitOnExecutionContext(ctx3)
    expect(await revalidated.text()).toBe('v2')
  })

  it('supports custom manual revalidation on workerd', async () => {
    const app = new Hono()
    let value = 'v1'
    let count = 0

    app.get(
      '/items',
      cacheMiddleware({
        maxAge: 60,
        swr: false,
        revalidateHeader: 'x-custom-revalidate',
      }),
      (c) => {
        count += 1
        return c.text(value)
      }
    )

    const ctx1 = createExecutionContext()
    const first = await app.request('http://localhost/items', {}, {}, ctx1)
    await waitOnExecutionContext(ctx1)
    expect(await first.text()).toBe('v1')

    value = 'v2'
    const ctx2 = createExecutionContext()
    const revalidated = await app.request(
      'http://localhost/items',
      { headers: { 'x-custom-revalidate': '1' } },
      {},
      ctx2
    )
    await waitOnExecutionContext(ctx2)
    expect(await revalidated.text()).toBe('v2')

    const ctx3 = createExecutionContext()
    const cached = await app.request('http://localhost/items', {}, {}, ctx3)
    await waitOnExecutionContext(ctx3)

    expect(await cached.text()).toBe('v2')
    expect(count).toBe(2)
  })

  it('refreshes stale entries synchronously on workerd', async () => {
    const app = new Hono()
    let count = 0

    app.get(
      '/items',
      cacheMiddleware({
        maxAge: 1,
        staleMaxAge: 60,
        swr: true,
      }),
      (c) => {
        count += 1
        return c.text(`value-${count}`)
      }
    )

    const ctx1 = createExecutionContext()
    const first = await app.request('http://localhost/items', {}, {}, ctx1)
    await waitOnExecutionContext(ctx1)
    expect(await first.text()).toBe('value-1')

    await new Promise((resolve) => setTimeout(resolve, 1100))

    const ctx2 = createExecutionContext()
    const refreshed = await app.request('http://localhost/items', {}, {}, ctx2)
    await waitOnExecutionContext(ctx2)
    expect(await refreshed.text()).toBe('value-2')

    const ctx3 = createExecutionContext()
    const cached = await app.request('http://localhost/items', {}, {}, ctx3)
    await waitOnExecutionContext(ctx3)
    expect(await cached.text()).toBe('value-2')
    expect(count).toBe(2)
  })
})
