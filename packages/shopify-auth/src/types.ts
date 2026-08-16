import type { Context } from 'hono'

/**
 * Claims carried by a Shopify App Bridge session token.
 *
 * @see https://shopify.dev/docs/apps/build/authentication-authorization/session-tokens
 */
export interface SessionTokenPayload {
  /** Shop admin origin, e.g. `https://example.myshopify.com/admin`. */
  iss: string
  /** Canonical shop origin, e.g. `https://example.myshopify.com`. */
  dest: string
  /** The app's API key. */
  aud: string
  /** The merchant user, prefixed by shop. */
  sub: string
  exp: number
  nbf: number
  iat: number
  jti: string
  /** App Bridge session id. Absent for some token versions. */
  sid?: string
}

/** A configuration value, or a function that derives it from the request context. */
export type ValueOrResolver<T> = T | ((c: Context) => T)

/** An offline access token plus everything needed to decide when to renew it. */
export interface StoredShopifySession {
  accessToken: string
  scope: string
  /** `null` is treated as *expired* — legacy non-expiring tokens are no longer accepted by Shopify. */
  expiresAt: Date | null
  refreshToken: string | null
  refreshTokenExpiresAt: Date | null
}

/**
 * Persistence for offline access tokens.
 *
 * `store` must be last-write-wins per shop: exactly one session survives for a
 * given shop. Shopify invalidates the previous refresh token whenever it issues
 * a new pair, so retaining older records means retaining dead credentials.
 */
export interface ShopifySessionStorage {
  load(shop: string): Promise<StoredShopifySession | null>
  store(shop: string, session: StoredShopifySession): Promise<void>
  delete(shop: string): Promise<void>
}

/**
 * Mints a fresh offline access token, persists it, and returns it — or `null`
 * when one cannot be obtained. Memoized per request.
 */
export type ReExchangeToken = () => Promise<string | null>

/** Established by `shopifySessionToken`: proof of which shop is calling. */
export interface ShopifyVerifiedSession {
  /** Shop domain, lowercased, e.g. `example.myshopify.com`. */
  shop: string
  payload: SessionTokenPayload
}

/** Established by `shopifyAccessToken`: a verified session plus Admin API credentials. */
export interface ShopifyAccessSession extends ShopifyVerifiedSession {
  accessToken: string
  scope: string
  reExchange: ReExchangeToken
}

/** A verified Shopify webhook delivery. */
export interface ShopifyWebhookContext {
  shop: string
  topic: string
  /** `X-Shopify-Webhook-Id`, useful for deduplicating retries. */
  webhookId: string | null
  payload: unknown
}

/** Reports failures that were handled internally rather than surfaced to the caller. */
export type ShopifyAuthErrorHandler = (error: Error, c: Context) => void

export interface ShopifySessionTokenOptions {
  /** Defaults to `SHOPIFY_API_KEY` from the environment. */
  apiKey?: ValueOrResolver<string>
  /** Defaults to `SHOPIFY_API_SECRET` from the environment. */
  apiSecret?: ValueOrResolver<string>
  /** Tolerance applied to `exp` and `nbf`, in seconds. Defaults to 10. */
  leewaySeconds?: number
  onError?: ShopifyAuthErrorHandler
}

export interface ShopifyAccessTokenOptions extends ShopifySessionTokenOptions {
  storage: ShopifySessionStorage
}

export interface ShopifyWebhookOptions {
  /** Defaults to `SHOPIFY_API_SECRET` from the environment. */
  apiSecret?: ValueOrResolver<string>
  onError?: ShopifyAuthErrorHandler
}

/** Context variables contributed by this package. */
export type ShopifyAuthVariables = {
  shopifySession: ShopifyVerifiedSession
  shopifyAccess: ShopifyAccessSession
  shopifyWebhook: ShopifyWebhookContext
}
