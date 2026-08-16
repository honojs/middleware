import type { Context, MiddlewareHandler } from 'hono'
import { env } from 'hono/adapter'
import { HTTPException } from 'hono/http-exception'
import { verifyShopifyHmac } from './hmac'
import { shopFromPayload, verifyShopifySessionToken } from './session-token'
import {
  exchangeForOfflineToken,
  isAccessTokenExpired,
  isRefreshTokenUsable,
  refreshAccessToken,
} from './token-exchange'
import type { IssuedToken } from './token-exchange'
import type {
  ReExchangeToken,
  SessionTokenPayload,
  ShopifyAccessSession,
  ShopifyAccessTokenOptions,
  ShopifyAuthErrorHandler,
  ShopifySessionStorage,
  ShopifySessionTokenOptions,
  ShopifyVerifiedSession,
  ShopifyWebhookContext,
  ShopifyWebhookOptions,
  StoredShopifySession,
  ValueOrResolver,
} from './types'

interface ShopifyEnv {
  SHOPIFY_API_KEY?: string
  SHOPIFY_API_SECRET?: string
  [key: string]: unknown
}

function resolve<T>(value: ValueOrResolver<T> | undefined, c: Context): T | undefined {
  return typeof value === 'function' ? (value as (c: Context) => T)(c) : value
}

function credential(
  configured: ValueOrResolver<string> | undefined,
  c: Context,
  variable: 'SHOPIFY_API_KEY' | 'SHOPIFY_API_SECRET'
): string {
  const value = resolve(configured, c) ?? env<ShopifyEnv>(c)[variable]
  if (!value) {
    throw new HTTPException(500, {
      message: `@hono/shopify-auth: ${variable} is not configured`,
    })
  }
  return value
}

function report(onError: ShopifyAuthErrorHandler | undefined, error: unknown, c: Context): void {
  onError?.(error instanceof Error ? error : new Error(String(error)), c)
}

/** Pulls the raw JWT out of `Authorization: Bearer <token>`. */
function bearerToken(c: Context): string {
  const match = /^Bearer\s+(.+)$/i.exec(c.req.header('Authorization') ?? '')
  const token = match?.[1]
  if (token === undefined) {
    throw new HTTPException(401, { message: 'Missing bearer token' })
  }
  return token
}

async function verifyRequest(
  c: Context,
  options: ShopifySessionTokenOptions
): Promise<{ rawToken: string; shop: string; payload: SessionTokenPayload }> {
  const apiKey = credential(options.apiKey, c, 'SHOPIFY_API_KEY')
  const apiSecret = credential(options.apiSecret, c, 'SHOPIFY_API_SECRET')

  const rawToken = bearerToken(c)
  const verifyOptions =
    options.leewaySeconds === undefined ? {} : { leewaySeconds: options.leewaySeconds }
  const payload = await verifyShopifySessionToken(rawToken, apiKey, apiSecret, verifyOptions)
  if (payload === null) {
    throw new HTTPException(401, { message: 'Invalid session token' })
  }

  return { rawToken, shop: shopFromPayload(payload), payload }
}

/**
 * Verifies the App Bridge session token on the request and establishes which
 * shop it came from. No storage, no network calls, no state.
 *
 * Reach for this when you only need to know *who* is calling, or when you
 * already manage Shopify access tokens yourself. Handlers read the result with
 * {@link getShopifySession}.
 */
export function shopifySessionToken(
  options: ShopifySessionTokenOptions = {}
): MiddlewareHandler<{ Variables: { shopifySession: ShopifyVerifiedSession } }> {
  return async function shopifySessionTokenMiddleware(c, next) {
    const { shop, payload } = await verifyRequest(c, options)
    c.set('shopifySession', { shop, payload })
    await next()
  }
}

function toStored(token: IssuedToken): StoredShopifySession {
  return {
    accessToken: token.accessToken,
    scope: token.scope,
    expiresAt: token.expiresAt,
    refreshToken: token.refreshToken,
    refreshTokenExpiresAt: token.refreshTokenExpiresAt,
  }
}

/**
 * Obtains a token for the shop, preferring the refresh grant when one is
 * available — it is cheaper than a full exchange, and it keeps the (very
 * short-lived) session token from being the single point of failure.
 */
async function acquireToken(
  c: Context,
  shop: string,
  rawToken: string,
  stored: StoredShopifySession | null,
  now: Date,
  apiKey: string,
  apiSecret: string,
  onError: ShopifyAuthErrorHandler | undefined
): Promise<IssuedToken> {
  if (isRefreshTokenUsable(stored, now) && stored?.refreshToken) {
    try {
      return await refreshAccessToken(shop, stored.refreshToken, apiKey, apiSecret)
    } catch (error) {
      // Recoverable: fall through to a full exchange below.
      report(onError, error, c)
    }
  }
  return exchangeForOfflineToken(shop, rawToken, apiKey, apiSecret)
}

/**
 * Everything {@link shopifySessionToken} does, and additionally guarantees a
 * usable Shopify Admin API access token for the shop.
 *
 * The stored token is reused while it remains valid. Once expired, it is
 * renewed with the refresh grant, falling back to a token exchange. Newly
 * issued tokens are persisted before the request proceeds. Handlers read the
 * result with {@link getShopifyAccess}.
 */
export function shopifyAccessToken(options: ShopifyAccessTokenOptions): MiddlewareHandler<{
  Variables: { shopifySession: ShopifyVerifiedSession; shopifyAccess: ShopifyAccessSession }
}> {
  const storage: ShopifySessionStorage = options.storage

  return async function shopifyAccessTokenMiddleware(c, next) {
    const apiKey = credential(options.apiKey, c, 'SHOPIFY_API_KEY')
    const apiSecret = credential(options.apiSecret, c, 'SHOPIFY_API_SECRET')
    const { rawToken, shop, payload } = await verifyRequest(c, options)

    const stored = await storage.load(shop)
    const now = new Date()

    let accessToken: string
    let scope: string

    if (!isAccessTokenExpired(stored, now) && stored !== null) {
      accessToken = stored.accessToken
      scope = stored.scope
    } else {
      let issued: IssuedToken
      try {
        issued = await acquireToken(
          c,
          shop,
          rawToken,
          stored,
          now,
          apiKey,
          apiSecret,
          options.onError
        )
      } catch (error) {
        report(options.onError, error, c)
        throw new HTTPException(403, {
          message: `Could not obtain an access token for ${shop}. Ensure the app is installed.`,
        })
      }
      await storage.store(shop, toStored(issued))
      accessToken = issued.accessToken
      scope = issued.scope
    }

    // Recovers from a token that is revoked but not yet expired — the
    // uninstall/reinstall race, where Shopify has already invalidated the token
    // while our stored copy still looks alive. Memoized, so several Admin API
    // calls within one request trigger at most one exchange.
    let pending: Promise<string | null> | null = null
    const reExchange: ReExchangeToken = () =>
      (pending ??= (async () => {
        try {
          const issued = await exchangeForOfflineToken(shop, rawToken, apiKey, apiSecret)
          await storage.store(shop, toStored(issued))
          const refreshed: ShopifyAccessSession = {
            shop,
            payload,
            accessToken: issued.accessToken,
            scope: issued.scope,
            reExchange,
          }
          c.set('shopifyAccess', refreshed)
          return issued.accessToken
        } catch (error) {
          report(options.onError, error, c)
          return null
        }
      })())

    const session: ShopifyAccessSession = { shop, payload, accessToken, scope, reExchange }
    c.set('shopifySession', { shop, payload })
    c.set('shopifyAccess', session)
    await next()
  }
}

/**
 * Verifies the `X-Shopify-Hmac-Sha256` signature over the raw request body,
 * then exposes the parsed delivery to handlers via {@link getShopifyWebhook}.
 *
 * The body is consumed in order to sign the exact bytes Shopify sent, so
 * `c.req.json()` will fail downstream.
 */
export function shopifyWebhook(
  options: ShopifyWebhookOptions = {}
): MiddlewareHandler<{ Variables: { shopifyWebhook: ShopifyWebhookContext } }> {
  return async function shopifyWebhookMiddleware(c, next) {
    const apiSecret = credential(options.apiSecret, c, 'SHOPIFY_API_SECRET')

    const rawBody = await c.req.arrayBuffer()
    const signature = c.req.header('X-Shopify-Hmac-Sha256') ?? null

    if (!(await verifyShopifyHmac(rawBody, signature, apiSecret))) {
      const shop = c.req.header('X-Shopify-Shop-Domain') ?? 'unknown'
      const topic = c.req.header('X-Shopify-Topic') ?? 'unknown'
      report(
        options.onError,
        new Error(`Shopify webhook HMAC verification failed for shop=${shop} topic=${topic}`),
        c
      )
      throw new HTTPException(401, { message: 'Invalid HMAC' })
    }

    let payload: unknown
    try {
      payload = JSON.parse(new TextDecoder().decode(rawBody))
    } catch (error) {
      report(options.onError, error, c)
      throw new HTTPException(400, { message: 'Invalid JSON body' })
    }

    c.set('shopifyWebhook', {
      shop: c.req.header('X-Shopify-Shop-Domain') ?? '',
      topic: c.req.header('X-Shopify-Topic') ?? '',
      webhookId: c.req.header('X-Shopify-Webhook-Id') ?? null,
      payload,
    })
    await next()
  }
}

/**
 * The verified session established by either session middleware.
 *
 * @throws if no Shopify session middleware ran for this request.
 */
export function getShopifySession(c: Context): ShopifyVerifiedSession {
  const session = c.get('shopifySession') as ShopifyVerifiedSession | undefined
  if (session === undefined) {
    throw new Error('@hono/shopify-auth: no session on this request. Did you add the middleware?')
  }
  return session
}

/**
 * The verified session plus Admin API credentials.
 *
 * @throws if `shopifyAccessToken` did not run for this request — the
 * verify-only `shopifySessionToken` middleware never establishes credentials.
 */
export function getShopifyAccess(c: Context): ShopifyAccessSession {
  const session = c.get('shopifyAccess') as ShopifyAccessSession | undefined
  if (session === undefined) {
    throw new Error(
      '@hono/shopify-auth: no access token on this request. Use shopifyAccessToken() rather than shopifySessionToken().'
    )
  }
  return session
}

/**
 * The verified webhook delivery.
 *
 * @throws if `shopifyWebhook` did not run for this request.
 */
export function getShopifyWebhook(c: Context): ShopifyWebhookContext {
  const webhook = c.get('shopifyWebhook') as ShopifyWebhookContext | undefined
  if (webhook === undefined) {
    throw new Error('@hono/shopify-auth: no webhook on this request. Did you add the middleware?')
  }
  return webhook
}
