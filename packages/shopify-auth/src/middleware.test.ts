import { Hono } from 'hono'
import { adminGraphql } from './admin-graphql'
import {
  getShopifyAccess,
  getShopifySession,
  getShopifyWebhook,
  shopifyAccessToken,
  shopifySessionToken,
  shopifyWebhook,
} from './middleware'
import { memoryStorage } from './storage'
import {
  API_KEY,
  API_SECRET,
  SHOP,
  authorizedRequest,
  signSessionToken,
  signWebhook,
  tokenResponse,
  webhookRequest,
} from './test-utils'
import type { ShopifySessionStorage, StoredShopifySession } from './types'

const credentials = { apiKey: API_KEY, apiSecret: API_SECRET }

/** A stored session that is still valid for another hour. */
const liveSession = (overrides: Partial<StoredShopifySession> = {}): StoredShopifySession => ({
  accessToken: 'shpua_stored',
  scope: 'read_products',
  expiresAt: new Date(Date.now() + 3_600_000),
  refreshToken: 'refresh_stored',
  refreshTokenExpiresAt: new Date(Date.now() + 7_776_000_000),
  ...overrides,
})

async function seed(
  storage: ShopifySessionStorage,
  overrides: Partial<StoredShopifySession> = {}
): Promise<void> {
  await storage.store(SHOP, liveSession(overrides))
}

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>

beforeEach(() => {
  fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(tokenResponse()))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/** The parsed form body of the nth token request. */
const tokenRequestBody = (call = 0): URLSearchParams => {
  const [, init] = fetchMock.mock.calls[call] as [string, RequestInit]
  return new URLSearchParams(init.body as string)
}

describe('shopifySessionToken', () => {
  const app = new Hono()
  app.use('/api/*', shopifySessionToken(credentials))
  app.get('/api/test', (c) => c.json(getShopifySession(c)))

  it('exposes the shop and claims', async () => {
    const res = await app.fetch(await authorizedRequest())
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({ shop: SHOP, payload: { aud: API_KEY } })
  })

  it('makes no network calls', async () => {
    await app.fetch(await authorizedRequest())
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects a request with no Authorization header', async () => {
    const res = await app.fetch(new Request('http://localhost/api/test'))
    expect(res.status).toBe(401)
  })

  it('rejects a non-bearer Authorization header', async () => {
    const res = await app.fetch(
      new Request('http://localhost/api/test', { headers: { Authorization: 'Basic abc' } })
    )
    expect(res.status).toBe(401)
  })

  it('rejects an invalid token', async () => {
    const token = await signSessionToken({}, { secret: 'wrong' })
    const res = await app.fetch(
      new Request('http://localhost/api/test', { headers: { Authorization: `Bearer ${token}` } })
    )
    expect(res.status).toBe(401)
  })

  it('reads credentials from the environment when none are configured', async () => {
    vi.stubEnv('SHOPIFY_API_KEY', API_KEY)
    vi.stubEnv('SHOPIFY_API_SECRET', API_SECRET)

    const envApp = new Hono()
    envApp.use('/api/*', shopifySessionToken())
    envApp.get('/api/test', (c) => c.json(getShopifySession(c)))

    const res = await envApp.fetch(await authorizedRequest())
    expect(res.status).toBe(200)
    vi.unstubAllEnvs()
  })

  it('accepts credentials resolved from the context', async () => {
    const resolverApp = new Hono()
    resolverApp.use(
      '/api/*',
      shopifySessionToken({ apiKey: () => API_KEY, apiSecret: () => API_SECRET })
    )
    resolverApp.get('/api/test', (c) => c.json(getShopifySession(c)))

    const res = await resolverApp.fetch(await authorizedRequest())
    expect(res.status).toBe(200)
  })

  it('fails with 500 when no credentials are available', async () => {
    vi.stubEnv('SHOPIFY_API_KEY', '')
    vi.stubEnv('SHOPIFY_API_SECRET', '')

    const bareApp = new Hono()
    bareApp.use('/api/*', shopifySessionToken())
    bareApp.get('/api/test', (c) => c.text('ok'))

    const res = await bareApp.fetch(await authorizedRequest())
    expect(res.status).toBe(500)
    vi.unstubAllEnvs()
  })
})

describe('shopifyAccessToken', () => {
  const buildApp = (storage: ShopifySessionStorage) => {
    const app = new Hono()
    app.use('/api/*', shopifyAccessToken({ ...credentials, storage }))
    app.get('/api/test', (c) => {
      const { shop, accessToken, scope } = getShopifyAccess(c)
      return c.json({ shop, accessToken, scope })
    })
    return app
  }

  describe('when the stored token is still valid', () => {
    it('uses it without contacting Shopify', async () => {
      const storage = memoryStorage()
      await seed(storage)

      const res = await buildApp(storage).fetch(await authorizedRequest())
      await expect(res.json()).resolves.toMatchObject({ accessToken: 'shpua_stored' })
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  describe('when there is no stored token', () => {
    it('performs a token exchange and persists the result', async () => {
      const storage = memoryStorage()
      const res = await buildApp(storage).fetch(await authorizedRequest())

      await expect(res.json()).resolves.toMatchObject({ accessToken: 'shpua_new_token' })
      await expect(storage.load(SHOP)).resolves.toMatchObject({
        accessToken: 'shpua_new_token',
        refreshToken: 'refresh_new',
      })
    })

    it('requests an expiring token', async () => {
      await buildApp(memoryStorage()).fetch(await authorizedRequest())

      const [url] = fetchMock.mock.calls[0] as [string]
      expect(url).toBe(`https://${SHOP}/admin/oauth/access_token`)

      const body = tokenRequestBody()
      // Without `expiring=1` Shopify issues a legacy non-expiring token that the
      // Admin API rejects with 403.
      expect(body.get('expiring')).toBe('1')
      expect(body.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:token-exchange')
      expect(body.get('subject_token_type')).toBe('urn:ietf:params:oauth:token-type:id_token')
      expect(body.get('requested_token_type')).toBe(
        'urn:shopify:params:oauth:token-type:offline-access-token'
      )
      expect(body.get('client_id')).toBe(API_KEY)
      expect(body.get('client_secret')).toBe(API_SECRET)
    })

    it('applies a safety buffer to the recorded expiry', async () => {
      const storage = memoryStorage()
      const before = Date.now()
      await buildApp(storage).fetch(await authorizedRequest())

      const stored = await storage.load(SHOP)
      // expires_in 3600, less the 60s buffer.
      const expected = before + 3_600_000 - 60_000
      expect(stored?.expiresAt?.getTime()).toBeGreaterThanOrEqual(expected - 1000)
      expect(stored?.expiresAt?.getTime()).toBeLessThanOrEqual(expected + 1000)
    })
  })

  describe('when the stored token has expired', () => {
    it('prefers the refresh grant', async () => {
      const storage = memoryStorage()
      await seed(storage, { expiresAt: new Date(Date.now() - 1000) })

      await buildApp(storage).fetch(await authorizedRequest())

      const body = tokenRequestBody()
      expect(body.get('grant_type')).toBe('refresh_token')
      expect(body.get('refresh_token')).toBe('refresh_stored')
    })

    it('falls back to a token exchange when the refresh is rejected', async () => {
      const storage = memoryStorage()
      await seed(storage, { expiresAt: new Date(Date.now() - 1000) })

      fetchMock.mockImplementationOnce(() =>
        Promise.resolve(new Response('invalid_grant', { status: 400 }))
      )

      const res = await buildApp(storage).fetch(await authorizedRequest())
      await expect(res.json()).resolves.toMatchObject({ accessToken: 'shpua_new_token' })
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(tokenRequestBody(1).get('grant_type')).toBe(
        'urn:ietf:params:oauth:grant-type:token-exchange'
      )
    })

    it('skips the refresh grant when the refresh token has also expired', async () => {
      const storage = memoryStorage()
      await seed(storage, {
        expiresAt: new Date(Date.now() - 1000),
        refreshTokenExpiresAt: new Date(Date.now() - 1000),
      })

      await buildApp(storage).fetch(await authorizedRequest())
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(tokenRequestBody().get('grant_type')).toBe(
        'urn:ietf:params:oauth:grant-type:token-exchange'
      )
    })

    it('skips the refresh grant when no refresh token was stored', async () => {
      const storage = memoryStorage()
      await seed(storage, { expiresAt: new Date(Date.now() - 1000), refreshToken: null })

      await buildApp(storage).fetch(await authorizedRequest())
      expect(tokenRequestBody().get('grant_type')).toBe(
        'urn:ietf:params:oauth:grant-type:token-exchange'
      )
    })
  })

  describe('legacy non-expiring tokens', () => {
    it('treats a null expiry as expired and re-exchanges', async () => {
      const storage = memoryStorage()
      await seed(storage, { accessToken: 'shpat_legacy', expiresAt: null, refreshToken: null })

      const res = await buildApp(storage).fetch(await authorizedRequest())
      await expect(res.json()).resolves.toMatchObject({ accessToken: 'shpua_new_token' })
    })
  })

  describe('failure', () => {
    it('answers 403 when Shopify refuses to issue a token', async () => {
      fetchMock.mockImplementation(() =>
        Promise.resolve(new Response('not installed', { status: 400 }))
      )

      const res = await buildApp(memoryStorage()).fetch(await authorizedRequest())
      expect(res.status).toBe(403)
    })

    it('reports the underlying error through onError', async () => {
      fetchMock.mockImplementation(() => Promise.resolve(new Response('nope', { status: 400 })))
      const onError = vi.fn()

      const app = new Hono()
      app.use('/api/*', shopifyAccessToken({ ...credentials, storage: memoryStorage(), onError }))
      app.get('/api/test', (c) => c.text('ok'))

      await app.fetch(await authorizedRequest())
      expect(onError).toHaveBeenCalled()
      expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(Error)
    })

    it('does not write to the console', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      fetchMock.mockImplementation(() => Promise.resolve(new Response('nope', { status: 400 })))

      await buildApp(memoryStorage()).fetch(await authorizedRequest())
      expect(error).not.toHaveBeenCalled()
      expect(warn).not.toHaveBeenCalled()
    })
  })

  describe('reExchange', () => {
    it('mints a fresh token and updates the context', async () => {
      const storage = memoryStorage()
      await seed(storage)

      const app = new Hono()
      app.use('/api/*', shopifyAccessToken({ ...credentials, storage }))
      app.get('/api/test', async (c) => {
        const fresh = await getShopifyAccess(c).reExchange()
        return c.json({ fresh, current: getShopifyAccess(c).accessToken })
      })

      const res = await app.fetch(await authorizedRequest())
      await expect(res.json()).resolves.toEqual({
        fresh: 'shpua_new_token',
        current: 'shpua_new_token',
      })
      await expect(storage.load(SHOP)).resolves.toMatchObject({ accessToken: 'shpua_new_token' })
    })

    it('exchanges once for concurrent callers', async () => {
      const storage = memoryStorage()
      await seed(storage)

      const app = new Hono()
      app.use('/api/*', shopifyAccessToken({ ...credentials, storage }))
      app.get('/api/test', async (c) => {
        const { reExchange } = getShopifyAccess(c)
        const results = await Promise.all([reExchange(), reExchange(), reExchange()])
        return c.json(results)
      })

      const res = await app.fetch(await authorizedRequest())
      await expect(res.json()).resolves.toEqual([
        'shpua_new_token',
        'shpua_new_token',
        'shpua_new_token',
      ])
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('returns null when the exchange fails', async () => {
      const storage = memoryStorage()
      await seed(storage)
      fetchMock.mockImplementation(() => Promise.resolve(new Response('nope', { status: 400 })))

      const app = new Hono()
      app.use('/api/*', shopifyAccessToken({ ...credentials, storage }))
      app.get('/api/test', async (c) => c.json({ fresh: await getShopifyAccess(c).reExchange() }))

      const res = await app.fetch(await authorizedRequest())
      await expect(res.json()).resolves.toEqual({ fresh: null })
    })
  })

  describe('accessors', () => {
    it('also exposes the verified session', async () => {
      const storage = memoryStorage()
      await seed(storage)

      const app = new Hono()
      app.use('/api/*', shopifyAccessToken({ ...credentials, storage }))
      app.get('/api/test', (c) => c.json(getShopifySession(c)))

      const res = await app.fetch(await authorizedRequest())
      await expect(res.json()).resolves.toMatchObject({ shop: SHOP })
    })

    it('getShopifyAccess throws behind the verify-only middleware', async () => {
      const app = new Hono()
      app.use('/api/*', shopifySessionToken(credentials))
      app.get('/api/test', (c) => c.json(getShopifyAccess(c)))
      app.onError((err, c) => c.text(err.message, 500))

      const res = await app.fetch(await authorizedRequest())
      expect(res.status).toBe(500)
      await expect(res.text()).resolves.toContain('shopifyAccessToken()')
    })
  })
})

describe('shopifyWebhook', () => {
  const buildApp = () => {
    const app = new Hono()
    app.use('/webhooks/*', shopifyWebhook({ apiSecret: API_SECRET }))
    app.post('/webhooks/test', (c) => c.json(getShopifyWebhook(c)))
    return app
  }

  const body = JSON.stringify({ id: 1, name: '#1001' })

  it('exposes the delivery on a valid signature', async () => {
    const res = await buildApp().fetch(await webhookRequest(body))
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      shop: SHOP,
      topic: 'orders/fulfilled',
      webhookId: null,
      payload: { id: 1, name: '#1001' },
    })
  })

  it('captures the webhook id when present', async () => {
    const res = await buildApp().fetch(
      await webhookRequest(body, { 'X-Shopify-Webhook-Id': 'wh-123' })
    )
    await expect(res.json()).resolves.toMatchObject({ webhookId: 'wh-123' })
  })

  it('rejects a tampered body', async () => {
    const signature = await signWebhook(body)
    const res = await buildApp().fetch(
      new Request('http://localhost/webhooks/test', {
        method: 'POST',
        headers: { 'X-Shopify-Hmac-Sha256': signature },
        body: JSON.stringify({ id: 2 }),
      })
    )
    expect(res.status).toBe(401)
  })

  it('rejects a missing signature', async () => {
    const res = await buildApp().fetch(
      new Request('http://localhost/webhooks/test', { method: 'POST', body })
    )
    expect(res.status).toBe(401)
  })

  it('answers 400 for a validly signed body that is not JSON', async () => {
    const res = await buildApp().fetch(await webhookRequest('not json'))
    expect(res.status).toBe(400)
  })

  it('reports verification failures through onError', async () => {
    const onError = vi.fn()
    const app = new Hono()
    app.use('/webhooks/*', shopifyWebhook({ apiSecret: API_SECRET, onError }))
    app.post('/webhooks/test', (c) => c.text('ok'))

    await app.fetch(
      new Request('http://localhost/webhooks/test', { method: 'POST', body, headers: {} })
    )
    expect(onError).toHaveBeenCalled()
  })

  // Hono caches the parsed body, so reading the raw bytes to verify the
  // signature does not prevent a handler from parsing the request again.
  it('leaves c.req.json() usable downstream', async () => {
    const app = new Hono()
    app.use('/webhooks/*', shopifyWebhook({ apiSecret: API_SECRET }))
    app.post('/webhooks/test', async (c) => c.json(await c.req.json()))

    const res = await app.fetch(await webhookRequest(body))
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ id: 1, name: '#1001' })
  })

  // The HMAC covers the body and nothing else, and the secret it is computed
  // with is the app's single API secret — shared by every shop that installs the
  // app. `X-Shopify-Shop-Domain` is therefore unsigned *and* attacker-chosen:
  // anyone who installs the app on their own store receives genuinely-signed
  // deliveries that they can replay under someone else's shop identity.
  //
  // A valid signature proves the body came from Shopify. It proves nothing at
  // all about which shop the delivery is for.
  describe('shop identity', () => {
    /** A correctly signed delivery whose shop header the caller picks freely. */
    async function spoofed(shopHeader: string | null, payload: string = body): Promise<Request> {
      const headers: Record<string, string> = {
        'X-Shopify-Hmac-Sha256': await signWebhook(payload),
        'X-Shopify-Topic': 'orders/fulfilled',
      }
      if (shopHeader !== null) {
        headers['X-Shopify-Shop-Domain'] = shopHeader
      }
      return new Request('http://localhost/webhooks/test', {
        method: 'POST',
        headers,
        body: payload,
      })
    }

    // `shop` is interpolated straight into an Admin API origin by adminGraphql
    // (`https://${shop}/admin/api/…`), so anything that is not a bare
    // myshopify.com hostname is a redirect of an authenticated request. The
    // fragment/query/path cases matter because a suffix-only check such as
    // `shop.endsWith('.myshopify.com')` passes them while the resulting URL
    // still resolves to the attacker's origin.
    it.each([
      ['a plain non-Shopify host', 'evil.example.com'],
      ['a suffix lookalike with no dot', 'notmyshopify.com'],
      ['myshopify.com as a left-hand label', 'example.myshopify.com.evil.example.com'],
      ['a smuggled fragment', 'evil.example.com#.myshopify.com'],
      ['a smuggled query string', 'evil.example.com?.myshopify.com'],
      ['a smuggled path', 'evil.example.com/.myshopify.com'],
      ['userinfo in the authority', 'user@shop.myshopify.com'],
      ['an explicit port', 'example.myshopify.com:8443'],
      ['embedded whitespace', 'exam ple.myshopify.com'],
      ['an empty value', ''],
    ])('rejects %s in X-Shopify-Shop-Domain', async (_case, shopHeader) => {
      const res = await buildApp().fetch(await spoofed(shopHeader))
      expect(res.status).toBe(401)
    })

    it('rejects a delivery carrying no shop header at all', async () => {
      const res = await buildApp().fetch(await spoofed(null))
      expect(res.status).toBe(401)
    })

    it('accepts a well-formed myshopify.com host', async () => {
      const res = await buildApp().fetch(await spoofed('another-shop.myshopify.com'))
      expect(res.status).toBe(200)
      await expect(res.json()).resolves.toMatchObject({ shop: 'another-shop.myshopify.com' })
    })

    // `ShopifyVerifiedSession.shop` is documented as lowercased, and storage is
    // keyed by it — a mixed-case header must not open a second session record.
    it('normalizes the shop domain to lower case', async () => {
      const res = await buildApp().fetch(await spoofed('Another-Shop.MyShopify.Com'))
      expect(res.status).toBe(200)
      await expect(res.json()).resolves.toMatchObject({ shop: 'another-shop.myshopify.com' })
    })

    it('reports a rejected shop domain through onError', async () => {
      const onError = vi.fn()
      const app = new Hono()
      app.use('/webhooks/*', shopifyWebhook({ apiSecret: API_SECRET, onError }))
      app.post('/webhooks/test', (c) => c.text('ok'))

      await app.fetch(await spoofed('evil.example.com'))
      expect(onError).toHaveBeenCalled()
    })

    // The concrete harm. `shop` flows into the Admin API origin, so an
    // unvalidated header sends `X-Shopify-Access-Token` to a host the attacker
    // controls. The handler below is the shape the README recommends.
    it('never sends the access token to a spoofed origin', async () => {
      const app = new Hono()
      app.use('/webhooks/*', shopifyWebhook({ apiSecret: API_SECRET }))
      app.post('/webhooks/test', async (c) => {
        const { shop } = getShopifyWebhook(c)
        await adminGraphql({
          shop,
          accessToken: 'shpua_victim_token',
          query: '{ shop { name } }',
        })
        return c.text('ok')
      })

      await app.fetch(await spoofed('evil.example.com'))

      const origins = fetchMock.mock.calls.map(
        ([input]) => new URL(input instanceof Request ? input.url : input.toString()).origin
      )
      expect(origins).not.toContain('https://evil.example.com')
      expect(fetchMock).not.toHaveBeenCalled()
    })

    // Deliveries that name the shop inside the signed body — the GDPR topics
    // (`customers/data_request`, `customers/redact`, `shop/redact`) all carry
    // `shop_domain` — can be bound to a shop cryptographically. Where the body
    // says which shop it is for, the unsigned header must not disagree.
    it('rejects a header that contradicts shop_domain in the signed body', async () => {
      const payload = JSON.stringify({ shop_id: 42, shop_domain: 'attacker.myshopify.com' })
      const res = await buildApp().fetch(await spoofed('victim.myshopify.com', payload))
      expect(res.status).toBe(401)
    })

    it('accepts a header that agrees with shop_domain in the signed body', async () => {
      const payload = JSON.stringify({ shop_id: 42, shop_domain: 'victim.myshopify.com' })
      const res = await buildApp().fetch(await spoofed('victim.myshopify.com', payload))
      expect(res.status).toBe(200)
      await expect(res.json()).resolves.toMatchObject({ shop: 'victim.myshopify.com' })
    })

    // Most topics (orders/*, products/*, …) carry no shop field, so there is
    // nothing to cross-check against and host validation is the only defence.
    it('accepts a payload with no shop field once the host is valid', async () => {
      const res = await buildApp().fetch(await spoofed('victim.myshopify.com'))
      expect(res.status).toBe(200)
      await expect(res.json()).resolves.toMatchObject({ shop: 'victim.myshopify.com' })
    })
  })
})
