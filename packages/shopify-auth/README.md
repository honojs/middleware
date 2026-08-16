# Shopify Auth middleware for Hono

Authenticate Shopify embedded app requests and webhooks in Hono, with **zero dependencies**.

Everything is built on Web Crypto and `fetch`, so it runs unchanged on Cloudflare Workers, Deno, Bun, Node.js, Vercel, and Fastly. There is no dependency on `@shopify/shopify-api` and no Node builtins.

The middleware implements the modern [token exchange](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/token-exchange) flow that Shopify recommends for embedded apps — expiring offline tokens, refresh-token rotation, and recovery from tokens revoked out of band. No OAuth redirect dance, no cookies.

## Installation

```plain
npm i hono @hono/shopify-auth
```

## Quick start

```ts
import { Hono } from 'hono'
import { shopifyAccessToken, getShopifyAccess } from '@hono/shopify-auth'

const app = new Hono()

app.use('/api/*', shopifyAccessToken({ storage }))

app.get('/api/shop', async (c) => {
  const { shop, accessToken } = getShopifyAccess(c)
  // shop        → 'example.myshopify.com'
  // accessToken → a valid offline access token, renewed if it had expired
})
```

## The two session middlewares

Pick based on whether you need to call the Shopify Admin API.

|                              | `shopifySessionToken` | `shopifyAccessToken`            |
| ---------------------------- | --------------------- | ------------------------------- |
| Verifies the App Bridge JWT  | ✅                    | ✅                              |
| Network calls                | none                  | only when a token needs minting |
| Requires storage             | no                    | yes                             |
| Gives you an Admin API token | no                    | ✅                              |
| Read the result with         | `getShopifySession`   | `getShopifyAccess`              |

### `shopifySessionToken` — verify only

Verifies the `Authorization: Bearer <jwt>` session token that App Bridge attaches to requests from the Shopify admin, and establishes which shop it came from. Nothing else: no storage, no network calls, no state.

Reach for this when you only need to know _who is calling_, or when you already manage Shopify access tokens yourself.

```ts
import { shopifySessionToken, getShopifySession } from '@hono/shopify-auth'

app.use('/api/*', shopifySessionToken())

app.get('/api/hello', (c) => {
  const { shop, payload } = getShopifySession(c)
  return c.json({ shop, sub: payload.sub })
})
```

The request is rejected with `401` unless all of the following hold:

- header `alg` is `HS256`, and the signature verifies against your API secret
- `exp` is in the future and `nbf` is in the past (both with 10s of leeway by default)
- `aud` equals your API key
- `dest` is an `https:` URL on a `*.myshopify.com` host
- `iss` has the same hostname as `dest`

The last two matter more than they look. Without them a validly signed token carrying an attacker-chosen `dest` would aim your subsequent Admin API calls at an arbitrary origin.

### `shopifyAccessToken` — full token lifecycle

Everything above, plus a guaranteed-usable **Admin API access token** for the shop.

On each request it loads the stored session and then:

- **Token still valid** → uses it as-is. No network call.
- **Token expired, refresh token usable** → exchanges the refresh token for a new pair.
- **No usable refresh token, or the refresh failed** → performs a token exchange using the incoming session token.

Newly issued tokens are persisted through your storage adapter before the request proceeds.

```ts
import { shopifyAccessToken, getShopifyAccess } from '@hono/shopify-auth'

app.use('/api/*', shopifyAccessToken({ storage }))

app.get('/api/products', async (c) => {
  const { shop, accessToken } = getShopifyAccess(c)
  // …call the Admin API
})
```

Tokens are requested with `expiring=1`, which yields a 60-minute access token paired with a 90-day refresh token. Expiry is recorded with a 60-second safety margin, so a token that is about to lapse is never presented mid-request.

`getShopifySession` also works behind this middleware — it returns the `shop` and `payload` subset. Calling `getShopifyAccess` behind the _verify-only_ middleware throws, because no credentials were ever established.

> [!NOTE]
> A session stored with `expiresAt: null` is treated as **expired**. Legacy non-expiring `shpat_*` tokens are rejected by the Admin API with `403`, so forcing a re-exchange lets old records heal themselves.

If no token can be obtained, the request fails with `403` — usually meaning the app is not installed on that shop.

## Storage

`shopifyAccessToken` needs somewhere to keep access tokens between requests. Rather than bundle a database, this package defines an interface:

```ts
interface ShopifySessionStorage {
  load(shop: string): Promise<StoredShopifySession | null>
  store(shop: string, session: StoredShopifySession): Promise<void>
  delete(shop: string): Promise<void>
}

interface StoredShopifySession {
  accessToken: string
  scope: string
  expiresAt: Date | null
  refreshToken: string | null
  refreshTokenExpiresAt: Date | null
}
```

`store` must be **last-write-wins per shop** — exactly one session survives for a given shop. Shopify invalidates the presented refresh token whenever it issues a new pair, so retaining older records means retaining dead credentials.

That has to hold atomically. An embedded app usually loads several endpoints at once, and on a cold cache every one of those requests misses, acquires its own token, and calls `store` concurrently. A single keyed write — like the `kv.put` below — is fine. A SQL adapter that deletes the shop's previous rows and then inserts the new one as two separate statements is not: those statements interleave under exactly that load and leave the shop with duplicates. Use an upsert against a unique key, or run the pair in a transaction.

A `memoryStorage()` helper ships for tests and local development:

```ts
import { memoryStorage } from '@hono/shopify-auth'

app.use('/api/*', shopifyAccessToken({ storage: memoryStorage() }))
```

It is not suitable for production: it does not survive a restart, and on serverless platforms it does not reliably survive between requests.

### Writing an adapter

Any key-value store or database works. Cloudflare KV, for example:

```ts
import type { ShopifySessionStorage, StoredShopifySession } from '@hono/shopify-auth'

const kvStorage = (kv: KVNamespace): ShopifySessionStorage => ({
  async load(shop) {
    const raw = await kv.get<Record<string, string | null>>(`shopify:${shop}`, 'json')
    if (!raw) return null
    return {
      accessToken: raw.accessToken!,
      scope: raw.scope!,
      expiresAt: raw.expiresAt ? new Date(raw.expiresAt) : null,
      refreshToken: raw.refreshToken ?? null,
      refreshTokenExpiresAt: raw.refreshTokenExpiresAt ? new Date(raw.refreshTokenExpiresAt) : null,
    } satisfies StoredShopifySession
  },
  async store(shop, session) {
    await kv.put(`shopify:${shop}`, JSON.stringify(session))
  },
  async delete(shop) {
    await kv.delete(`shopify:${shop}`)
  },
})
```

## Recovering from revoked tokens

A merchant who uninstalls and immediately reinstalls your app leaves you holding a token that has not expired but no longer works. Shopify answers `401`, and there is no way to know in advance.

The session exposes `reExchange()` for exactly this. It mints a fresh token, persists it, updates the context, and returns it. It is memoized per request, so several concurrent Admin API calls trigger at most one exchange.

```ts
const { shop, accessToken, reExchange } = getShopifyAccess(c)

let res = await callAdminApi(shop, accessToken)
if (res.status === 401) {
  const fresh = await reExchange()
  if (fresh) res = await callAdminApi(shop, fresh)
}
```

The bundled `adminGraphql` helper does this for you:

```ts
import { adminGraphql } from '@hono/shopify-auth'

const { shop, accessToken, reExchange } = getShopifyAccess(c)

const data = await adminGraphql<{ shop: { name: string } }>({
  shop,
  accessToken,
  reExchange, // retries once on 401 with a freshly minted token
  query: `query { shop { name } }`,
})
```

It throws `ShopifyGraphqlError` on a non-2xx response or when the body carries top-level `errors`, and the `ShopifyAccessDeniedError` subclass on `401`/`403` or an `ACCESS_DENIED` extension code — so a missing scope can be handled separately from a transient failure. `userErrors` nested inside `data` are _not_ treated as fatal; inspect those yourself.

## Webhooks

`shopifyWebhook` verifies the `X-Shopify-Hmac-Sha256` signature over the raw request body, then exposes the parsed delivery.

```ts
import { shopifyWebhook, getShopifyWebhook } from '@hono/shopify-auth'

app.use('/webhooks/*', shopifyWebhook())

app.post('/webhooks/orders/fulfilled', async (c) => {
  const { shop, topic, webhookId, payload } = getShopifyWebhook(c)
  return c.body(null, 200)
})
```

Responds `401` when the signature does not verify and `400` when the body is not valid JSON. `webhookId` carries `X-Shopify-Webhook-Id`, which is useful for deduplicating Shopify's retries.

The middleware reads the raw body in order to verify the signature over the exact bytes Shopify sent. Hono caches the parsed body, so `c.req.json()` still works in your handler.

### How `shop` is trusted

The HMAC covers the request body, not the headers, so `X-Shopify-Shop-Domain` is not signed. That matters less than it sounds: signature verification runs first, so only Shopify — or someone holding your API secret — ever reaches the point where `shop` is read.

The middleware still checks it, for two reasons:

- **It must be a bare `myshopify.com` host**, matched in full and lowercased, because `shop` becomes an Admin API origin (`https://${shop}/admin/api/…`). This is containment against a compromised API secret: with the check, a leaked secret lets an attacker forge webhook payloads; without it, the same leak lets them harvest every shop's access token by naming a server of their own. Failures answer `401`.
- **Where the payload names its own shop, the header must agree.** The GDPR topics (`customers/data_request`, `customers/redact`, `shop/redact`) carry `shop_domain` and `shop/*` carries `myshopify_domain`, all inside the signed body. This catches a genuine delivery that leaked — through request logging or error reporting — being replayed under a different shop. It does nothing against a leaked secret, since anyone with the secret would sign a matching body. Failures answer `401`.

Most topics carry no shop field, so for `orders/*`, `products/*` and the rest the host check is all there is. If a handler acts on webhook data in ways that matter, confirm the shop is one of yours before trusting it:

```ts
app.post('/webhooks/orders/fulfilled', async (c) => {
  const { shop, payload } = getShopifyWebhook(c)
  if ((await storage.load(shop)) === null) {
    return c.body(null, 200) // not an active install; acknowledge and drop
  }
  // ...
})
```

`normalizeShopDomain` is exported for the same check elsewhere — an OAuth `shop` query parameter, say, which is genuinely attacker-supplied since no signature gates it:

```ts
import { normalizeShopDomain } from '@hono/shopify-auth'

const shop = normalizeShopDomain(c.req.query('shop'))
if (shop === null) return c.text('Invalid shop', 400)
```

## Scopes

```ts
import { missingScopes } from '@hono/shopify-auth'

const { scope } = getShopifyAccess(c)
const missing = missingScopes(scope, ['read_products', 'write_orders'])
if (missing.length) {
  return c.json({ error: 'Missing scopes', missing }, 403)
}
```

A `write_*` grant satisfies a `read_*` requirement for the same resource, matching how Shopify issues scopes: an app that asks for `write_products` gets read access too, but the token response lists only `write_products`. So `missingScopes('write_products', ['read_products'])` is `[]`.

## Configuration

All three middlewares read credentials from the environment via [`env()`](https://hono.dev/docs/helpers/adapter), so they work across runtimes with no configuration:

| Variable             | Used by                                     |
| -------------------- | ------------------------------------------- |
| `SHOPIFY_API_KEY`    | `shopifySessionToken`, `shopifyAccessToken` |
| `SHOPIFY_API_SECRET` | all three                                   |

To source them elsewhere, pass them explicitly — as values, or as functions of the context:

```ts
shopifyAccessToken({
  apiKey: (c) => c.env.MY_APP_KEY,
  apiSecret: (c) => c.env.MY_APP_SECRET,
  storage,
})
```

### Options

| Option          | Type                      | Default              | Applies to           |
| --------------- | ------------------------- | -------------------- | -------------------- |
| `apiKey`        | `string \| (c) => string` | `SHOPIFY_API_KEY`    | session middlewares  |
| `apiSecret`     | `string \| (c) => string` | `SHOPIFY_API_SECRET` | all                  |
| `storage`       | `ShopifySessionStorage`   | — (required)         | `shopifyAccessToken` |
| `leewaySeconds` | `number`                  | `10`                 | session middlewares  |
| `onError`       | `(error, c) => void`      | —                    | all                  |

Failures that are recovered from internally — a refresh grant Shopify rejects before the fallback exchange succeeds, for instance — are reported through `onError`. Nothing is ever written to the console.

`adminGraphql` takes `apiVersion` separately, defaulting to the exported `DEFAULT_API_VERSION`.

## Type safety

Context variables are declared globally, so the accessors are typed without extra setup:

```ts
interface ShopifyVerifiedSession {
  shop: string // 'example.myshopify.com', lowercased
  payload: SessionTokenPayload // verified JWT claims
}

interface ShopifyAccessSession extends ShopifyVerifiedSession {
  accessToken: string
  scope: string
  reExchange: () => Promise<string | null>
}
```

`ShopifyAuthVariables` is exported for apps that prefer to type their `Hono` instance explicitly:

```ts
import type { ShopifyAuthVariables } from '@hono/shopify-auth'

const app = new Hono<{ Variables: ShopifyAuthVariables }>()
```

## Low-level functions

The primitives are exported for use outside of middleware — in a queue consumer or scheduled job, say:

```ts
import {
  verifyShopifySessionToken, // → SessionTokenPayload | null
  shopFromPayload, // → 'example.myshopify.com'
  verifyShopifyHmac, // → boolean
} from '@hono/shopify-auth'
```

`verifyShopifySessionToken` returns `null` on any failure rather than throwing, and performs no I/O.

## Author

Besart Kodraliu <https://github.com/besart-k>

## License

MIT
