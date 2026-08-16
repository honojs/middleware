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
const TOKEN_EXCHANGE = 'urn:ietf:params:oauth:grant-type:token-exchange'

/** A stored session that is still valid for another hour. */
const liveSession = (overrides: Partial<StoredShopifySession> = {}): StoredShopifySession => ({
  accessToken: 'shpua_stored',
  scope: 'read_products',
  expiresAt: new Date(Date.now() + 3_600_000),
  refreshToken: 'refresh_stored',
  refreshTokenExpiresAt: new Date(Date.now() + 7_776_000_000),
  ...overrides,
})

/** A store already holding a session for {@link SHOP}. Age it with overrides. */
async function seeded(
  overrides: Partial<StoredShopifySession> = {}
): Promise<ShopifySessionStorage> {
  const storage = memoryStorage()
  await storage.store(SHOP, liveSession(overrides))
  return storage
}

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>

beforeEach(() => {
  fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(tokenResponse()))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
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

  it('exposes the shop and claims, without contacting Shopify', async () => {
    const res = await app.fetch(await authorizedRequest())
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({ shop: SHOP, payload: { aud: API_KEY } })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    ['no Authorization header', {}],
    ['a non-bearer Authorization header', { Authorization: 'Basic abc' }],
  ])('rejects a request with %s', async (_label, headers) => {
    const res = await app.fetch(new Request('http://localhost/api/test', { headers }))
    expect(res.status).toBe(401)
  })

  it('rejects a token signed with the wrong secret', async () => {
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
  })

  it('fails with 500 when no credentials are available', async () => {
    vi.stubEnv('SHOPIFY_API_KEY', '')
    vi.stubEnv('SHOPIFY_API_SECRET', '')

    const bareApp = new Hono()
    bareApp.use('/api/*', shopifySessionToken())
    bareApp.get('/api/test', (c) => c.text('ok'))

    const res = await bareApp.fetch(await authorizedRequest())
    expect(res.status).toBe(500)
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

  it('reuses a valid stored token without contacting Shopify', async () => {
    const res = await buildApp(await seeded()).fetch(await authorizedRequest())

    await expect(res.json()).resolves.toMatchObject({ accessToken: 'shpua_stored' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  describe('when there is no stored token', () => {
    it('exchanges, persists the result and buffers the recorded expiry', async () => {
      const storage = memoryStorage()
      const before = Date.now()
      const res = await buildApp(storage).fetch(await authorizedRequest())

      await expect(res.json()).resolves.toMatchObject({ accessToken: 'shpua_new_token' })
      const stored = await storage.load(SHOP)
      expect(stored).toMatchObject({ accessToken: 'shpua_new_token', refreshToken: 'refresh_new' })
      // expires_in 3600, less the 60s buffer.
      const expected = before + 3_600_000 - 60_000
      expect(stored?.expiresAt?.getTime()).toBeGreaterThanOrEqual(expected - 1000)
      expect(stored?.expiresAt?.getTime()).toBeLessThanOrEqual(expected + 1000)
    })

    it('requests an expiring token', async () => {
      await buildApp(memoryStorage()).fetch(await authorizedRequest())

      const [url] = fetchMock.mock.calls[0] as [string]
      expect(url).toBe(`https://${SHOP}/admin/oauth/access_token`)

      const body = tokenRequestBody()
      // Without `expiring=1` Shopify issues a legacy non-expiring token that the
      // Admin API rejects with 403.
      expect(body.get('expiring')).toBe('1')
      expect(body.get('grant_type')).toBe(TOKEN_EXCHANGE)
      expect(body.get('subject_token_type')).toBe('urn:ietf:params:oauth:token-type:id_token')
      expect(body.get('requested_token_type')).toBe(
        'urn:shopify:params:oauth:token-type:offline-access-token'
      )
      expect(body.get('client_id')).toBe(API_KEY)
      expect(body.get('client_secret')).toBe(API_SECRET)
    })
  })

  describe('when the stored token is no longer usable', () => {
    const expired = { expiresAt: new Date(Date.now() - 1000) }

    it('prefers the refresh grant', async () => {
      await buildApp(await seeded(expired)).fetch(await authorizedRequest())

      const body = tokenRequestBody()
      expect(body.get('grant_type')).toBe('refresh_token')
      expect(body.get('refresh_token')).toBe('refresh_stored')
    })

    // A legacy non-expiring token records a null expiry and is re-exchanged for
    // the same reason as the others: there is nothing usable to refresh with.
    it.each([
      [
        'the refresh token has also expired',
        { ...expired, refreshTokenExpiresAt: new Date(Date.now() - 1000) },
      ],
      ['no refresh token was stored', { ...expired, refreshToken: null }],
      ['the stored token never expires', { expiresAt: null, refreshToken: null }],
    ])('exchanges directly when %s', async (_label, overrides) => {
      const res = await buildApp(await seeded(overrides)).fetch(await authorizedRequest())

      await expect(res.json()).resolves.toMatchObject({ accessToken: 'shpua_new_token' })
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(tokenRequestBody().get('grant_type')).toBe(TOKEN_EXCHANGE)
    })

    it('falls back to a token exchange when the refresh is rejected', async () => {
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve(new Response('invalid_grant', { status: 400 }))
      )

      const res = await buildApp(await seeded(expired)).fetch(await authorizedRequest())

      await expect(res.json()).resolves.toMatchObject({ accessToken: 'shpua_new_token' })
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(tokenRequestBody(1).get('grant_type')).toBe(TOKEN_EXCHANGE)
    })
  })

  describe('failure', () => {
    /** An app whose middleware reports failures to the returned spy. */
    const reportingApp = (storage: ShopifySessionStorage = memoryStorage()) => {
      const onError = vi.fn()
      const app = new Hono()
      app.use('/api/*', shopifyAccessToken({ ...credentials, storage, onError }))
      app.get('/api/test', (c) => c.text('ok'))
      return { app, onError }
    }

    // Shopify refuses a grant either with an error status or with a 200 carrying
    // `{"error": ...}`, so an unchecked body would leave `accessToken` undefined
    // behind a 200 response.
    it.each([
      ['an error status', () => Promise.resolve(new Response('not installed', { status: 400 }))],
      [
        'a 2xx carrying no access token',
        () => Promise.resolve(Response.json({ error: 'invalid_subject_token' })),
      ],
      ['a 2xx carrying no scope', () => Promise.resolve(tokenResponse({ scope: undefined }))],
      ['a 2xx that is not JSON', () => Promise.resolve(new Response('<html>maintenance</html>'))],
    ])('answers 403 and stores nothing when Shopify replies with %s', async (_label, reply) => {
      fetchMock.mockImplementation(reply)
      const storage = memoryStorage()

      const res = await buildApp(storage).fetch(await authorizedRequest())
      expect(res.status).toBe(403)
      await expect(storage.load(SHOP)).resolves.toBeNull()
    })

    it('reports the underlying error through onError, and stays off the console', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      fetchMock.mockImplementation(() => Promise.resolve(new Response('nope', { status: 400 })))
      const { app, onError } = reportingApp()

      await app.fetch(await authorizedRequest())
      expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(Error)
      expect(error).not.toHaveBeenCalled()
      expect(warn).not.toHaveBeenCalled()
    })

    // A partial body can still hold token material, so the response is never
    // quoted back in the error message.
    it('does not quote the response body back through onError', async () => {
      fetchMock.mockImplementation(() =>
        Promise.resolve(Response.json({ access_token: 'shpua_leaked' }))
      )
      const { app, onError } = reportingApp()

      await app.fetch(await authorizedRequest())
      expect(onError).toHaveBeenCalled()
      expect((onError.mock.calls[0]?.[0] as Error).message).not.toContain('shpua_leaked')
    })
  })

  describe('reExchange', () => {
    /** Route that re-exchanges, reporting the fresh token and the context's own. */
    const reExchangeApp = (storage: ShopifySessionStorage) => {
      const app = new Hono()
      app.use('/api/*', shopifyAccessToken({ ...credentials, storage }))
      app.get('/api/test', async (c) => {
        const fresh = await getShopifyAccess(c).reExchange()
        return c.json({ fresh, current: getShopifyAccess(c).accessToken })
      })
      return app
    }

    it('mints a fresh token and updates the context', async () => {
      const storage = await seeded()

      const res = await reExchangeApp(storage).fetch(await authorizedRequest())

      await expect(res.json()).resolves.toEqual({
        fresh: 'shpua_new_token',
        current: 'shpua_new_token',
      })
      await expect(storage.load(SHOP)).resolves.toMatchObject({ accessToken: 'shpua_new_token' })
    })

    it('exchanges once for concurrent callers', async () => {
      const app = new Hono()
      app.use('/api/*', shopifyAccessToken({ ...credentials, storage: await seeded() }))
      app.get('/api/test', async (c) => {
        const { reExchange } = getShopifyAccess(c)
        return c.json(await Promise.all([reExchange(), reExchange(), reExchange()]))
      })

      const res = await app.fetch(await authorizedRequest())
      await expect(res.json()).resolves.toEqual([
        'shpua_new_token',
        'shpua_new_token',
        'shpua_new_token',
      ])
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    // A failed re-exchange leaves the caller with the token it already had,
    // rather than an emptied context or a half-written session.
    it.each([
      ['the exchange fails', () => Promise.resolve(new Response('nope', { status: 400 }))],
      [
        'a 2xx carries no token',
        () => Promise.resolve(Response.json({ error: 'invalid_subject_token' })),
      ],
    ])('returns null and leaves the stored session intact when %s', async (_label, reply) => {
      const storage = await seeded()
      fetchMock.mockImplementation(reply)

      const res = await reExchangeApp(storage).fetch(await authorizedRequest())

      await expect(res.json()).resolves.toEqual({ fresh: null, current: 'shpua_stored' })
      await expect(storage.load(SHOP)).resolves.toMatchObject({ accessToken: 'shpua_stored' })
    })
  })

  // A resolver may reach a secrets manager or a Secrets Store binding, so it is
  // part of the per-request latency budget rather than free configuration.
  describe('credential resolvers', () => {
    const resolverApp = (storage: ShopifySessionStorage) => {
      const apiKey = vi.fn(() => API_KEY)
      const apiSecret = vi.fn(() => API_SECRET)

      const app = new Hono()
      app.use('/api/*', shopifyAccessToken({ apiKey, apiSecret, storage }))
      app.get('/api/test', (c) => c.json({ accessToken: getShopifyAccess(c).accessToken }))
      app.get('/api/re-exchange', async (c) =>
        c.json({ fresh: await getShopifyAccess(c).reExchange() })
      )
      return { app, apiKey, apiSecret }
    }

    it.each<[string, () => Promise<ShopifySessionStorage>, string]>([
      ['the stored token is reused', () => seeded(), 'test'],
      ['a token exchange is needed', () => Promise.resolve(memoryStorage()), 'test'],
      ['the handler re-exchanges', () => seeded(), 're-exchange'],
    ])('runs each resolver once when %s', async (_label, storage, path) => {
      const { app, apiKey, apiSecret } = resolverApp(await storage())

      const res = await app.fetch(await authorizedRequest(`http://localhost/api/${path}`))
      expect(res.status).toBe(200)
      expect(apiKey).toHaveBeenCalledTimes(1)
      expect(apiSecret).toHaveBeenCalledTimes(1)
    })

    it('passes the resolved credentials to the token grant, not just the verification', async () => {
      const { app } = resolverApp(memoryStorage())

      await app.fetch(await authorizedRequest())

      expect(tokenRequestBody().get('client_id')).toBe(API_KEY)
      expect(tokenRequestBody().get('client_secret')).toBe(API_SECRET)
    })
  })

  describe('accessors', () => {
    it('also exposes the verified session', async () => {
      const app = new Hono()
      app.use('/api/*', shopifyAccessToken({ ...credentials, storage: await seeded() }))
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

  /** A correctly signed delivery whose shop header the caller picks freely. */
  async function spoofed(shopHeader: string | null, payload: string = body): Promise<Request> {
    const headers: Record<string, string> = {
      'X-Shopify-Hmac-Sha256': await signWebhook(payload),
      'X-Shopify-Topic': 'orders/fulfilled',
    }
    if (shopHeader !== null) {
      headers['X-Shopify-Shop-Domain'] = shopHeader
    }
    return new Request('http://localhost/webhooks/test', { method: 'POST', headers, body: payload })
  }

  /** A delivery carrying no signature at all. */
  const unsigned = (): Promise<Request> =>
    Promise.resolve(new Request('http://localhost/webhooks/test', { method: 'POST', body }))

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

  it.each([
    [
      'a tampered body',
      async () =>
        new Request('http://localhost/webhooks/test', {
          method: 'POST',
          headers: { 'X-Shopify-Hmac-Sha256': await signWebhook(body) },
          body: JSON.stringify({ id: 2 }),
        }),
    ],
    ['a missing signature', unsigned],
  ])('rejects %s', async (_label, request) => {
    const res = await buildApp().fetch(await request())
    expect(res.status).toBe(401)
  })

  it('answers 400 for a validly signed body that is not JSON', async () => {
    const res = await buildApp().fetch(await webhookRequest('not json'))
    expect(res.status).toBe(400)
  })

  it.each([
    ['an invalid signature', unsigned],
    ['a rejected shop domain', () => spoofed('evil.example.com')],
  ])('reports %s through onError', async (_label, request) => {
    const onError = vi.fn()
    const app = new Hono()
    app.use('/webhooks/*', shopifyWebhook({ apiSecret: API_SECRET, onError }))
    app.post('/webhooks/test', (c) => c.text('ok'))

    await app.fetch(await request())
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
      ['no shop header at all', null],
    ])('rejects %s in X-Shopify-Shop-Domain', async (_case, shopHeader) => {
      const res = await buildApp().fetch(await spoofed(shopHeader))
      expect(res.status).toBe(401)
    })

    // Most topics (orders/*, products/*, …) carry no shop field, so there is
    // nothing to cross-check against and host validation is the only defence.
    //
    // `ShopifyVerifiedSession.shop` is documented as lowercased, and storage is
    // keyed by it — a mixed-case header must not open a second session record.
    it.each([
      ['a well-formed myshopify.com host', 'another-shop.myshopify.com'],
      ['a mixed-case host, lowercased', 'Another-Shop.MyShopify.Com'],
    ])('accepts %s', async (_label, shopHeader) => {
      const res = await buildApp().fetch(await spoofed(shopHeader))
      expect(res.status).toBe(200)
      await expect(res.json()).resolves.toMatchObject({ shop: 'another-shop.myshopify.com' })
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
    it.each([
      ['contradicts', 'attacker.myshopify.com', 401],
      ['agrees with', 'victim.myshopify.com', 200],
    ])('%s shop_domain in the signed body → %i', async (_label, signedShop, status) => {
      const payload = JSON.stringify({ shop_id: 42, shop_domain: signedShop })

      const res = await buildApp().fetch(await spoofed('victim.myshopify.com', payload))

      expect(res.status).toBe(status)
    })
  })
})
