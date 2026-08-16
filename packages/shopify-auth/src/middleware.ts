import type { Context, MiddlewareHandler } from 'hono'
import { env } from 'hono/adapter'
import { HTTPException } from 'hono/http-exception'
import { verifyShopifyHmac } from './hmac'
import { shopFromPayload, verifyShopifySessionToken } from './session-token'
import { normalizeShopDomain, shopFromWebhookPayload } from './shop-domain'
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

/**
 * Resolved credentials are returned alongside the verified session so callers
 * that need them again — `shopifyAccessToken`, for the token grants — reuse
 * these rather than resolving a second time. Resolvers may reach a secrets
 * manager or carry side effects, so each runs exactly once per request.
 */
async function verifyRequest(
  c: Context,
  options: ShopifySessionTokenOptions
): Promise<{
  rawToken: string
  shop: string
  payload: SessionTokenPayload
  apiKey: string
  apiSecret: string
}> {
  const apiKey = credential(options.apiKey, c, 'SHOPIFY_API_KEY')
  const apiSecret = credential(options.apiSecret, c, 'SHOPIFY_API_SECRET')

  const rawToken = bearerToken(c)
  const verifyOptions =
    options.leewaySeconds === undefined ? {} : { leewaySeconds: options.leewaySeconds }
  const payload = await verifyShopifySessionToken(rawToken, apiKey, apiSecret, verifyOptions)
  if (payload === null) {
    throw new HTTPException(401, { message: 'Invalid session token' })
  }

  return { rawToken, shop: shopFromPayload(payload), payload, apiKey, apiSecret }
}

/**
 * Verifies the App Bridge session token on the request and establishes which
 * shop it came from. No storage, no network calls, no state.
 *
 * Reach for this when you only need to know *who* is calling, or when you
 * already manage Shopify access tokens yourself. Handlers read the result with
 * {@link getShopifySession}.
 */
export function shopifySessionToken(options: ShopifySessionTokenOptions = {}): MiddlewareHandler {
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
export function shopifyAccessToken(options: ShopifyAccessTokenOptions): MiddlewareHandler {
  const storage: ShopifySessionStorage = options.storage

  return async function shopifyAccessTokenMiddleware(c, next) {
    const { rawToken, shop, payload, apiKey, apiSecret } = await verifyRequest(c, options)

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
 * `shop` is additionally validated as a `myshopify.com` host, and — on the
 * topics whose payload names its own shop — checked against that. Both are
 * containment measures rather than gates: see the comments below for what they
 * do and do not buy you.
 *
 * Reading the raw bytes does not consume the body for handlers: Hono caches the
 * parsed result, so `c.req.json()` still works downstream.
 */
export function shopifyWebhook(options: ShopifyWebhookOptions = {}): MiddlewareHandler {
  return async function shopifyWebhookMiddleware(c, next) {
    const apiSecret = credential(options.apiSecret, c, 'SHOPIFY_API_SECRET')

    const rawBody = await c.req.arrayBuffer()
    const shopHeader = c.req.header('X-Shopify-Shop-Domain') ?? null
    const topic = c.req.header('X-Shopify-Topic') ?? ''

    /** Reports why the delivery was refused, then answers with `status`. */
    const refuse = (status: 400 | 401, message: string, reason: unknown): HTTPException => {
      report(options.onError, reason, c)
      return new HTTPException(status, { message })
    }

    const signature = c.req.header('X-Shopify-Hmac-Sha256') ?? null
    if (!(await verifyShopifyHmac(rawBody, signature, apiSecret))) {
      throw refuse(
        401,
        'Invalid HMAC',
        new Error(`Shopify webhook HMAC failed for shop=${shopHeader} topic=${topic}`)
      )
    }

    // Past the HMAC, so this delivery came from Shopify or from someone holding
    // the API secret — `shop` is not attacker-supplied in normal operation. It
    // is validated anyway because it is about to become an Admin API origin.
    // Should the secret ever leak, this line is the difference between an
    // attacker forging webhook payloads and an attacker collecting every shop's
    // access token by naming a host of their own.
    //
    // Lowercasing is unrelated to that: storage is keyed by `shop`, so an
    // unnormalized header would open a second session record for one store.
    const shop = normalizeShopDomain(shopHeader)
    if (shop === null) {
      throw refuse(
        401,
        'Invalid shop domain',
        new Error(`Shopify webhook shop is not a myshopify.com host: ${shopHeader}`)
      )
    }

    let payload: unknown
    try {
      payload = JSON.parse(new TextDecoder().decode(rawBody))
    } catch (error) {
      throw refuse(400, 'Invalid JSON body', error)
    }

    // Guards a leaked *delivery* rather than a leaked secret: anyone holding the
    // secret would just sign a body whose shop_domain matches the header. But a
    // genuine signed body recovered from a log can be replayed under a different
    // shop, and the topics carrying shop_domain are the ones where that does
    // real harm — a `customers/redact` aimed at a store that never asked for it.
    const signedShop = shopFromWebhookPayload(payload)
    if (signedShop !== null && signedShop !== shop) {
      throw refuse(
        401,
        'Shop domain does not match the signed payload',
        new Error(`Shopify webhook shop ${shop} contradicts signed payload ${signedShop}`)
      )
    }

    c.set('shopifyWebhook', {
      shop,
      topic,
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
