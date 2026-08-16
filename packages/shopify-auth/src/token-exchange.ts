import type { StoredShopifySession } from './types'

const TOKEN_EXCHANGE_GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:token-exchange'
const ID_TOKEN_TYPE = 'urn:ietf:params:oauth:token-type:id_token'
const OFFLINE_ACCESS_TOKEN_TYPE = 'urn:shopify:params:oauth:token-type:offline-access-token'

/**
 * Renew shortly before the moment of expiry, so a token that is technically
 * still alive is never presented to the Admin API mid-request.
 */
export const EXPIRY_SAFETY_BUFFER_MS = 60_000

interface ShopifyTokenJson {
  access_token: string
  scope: string
  expires_in?: number
  refresh_token?: string
  refresh_token_expires_in?: number
  /** Carried *instead of* a token when Shopify refuses the grant with a 200. */
  error?: string
}

/** A token response, resolved against the clock at the moment it was issued. */
export interface IssuedToken {
  accessToken: string
  scope: string
  expiresAt: Date | null
  refreshToken: string | null
  refreshTokenExpiresAt: Date | null
}

/**
 * How long an issued token can be trusted: its lifetime, less the safety
 * buffer.
 *
 * The buffer never takes more than half the grant. Subtracting a flat 60s from
 * a shorter lifetime would record the token as expired the moment it arrived,
 * and every request would mint — and rotate the refresh token for — a new one.
 */
function usableLifetimeMs(expiresInSeconds: number): number {
  const lifetime = expiresInSeconds * 1000
  return lifetime - Math.min(EXPIRY_SAFETY_BUFFER_MS, lifetime / 2)
}

function toIssuedToken(data: ShopifyTokenJson, nowMs: number): IssuedToken {
  return {
    accessToken: data.access_token,
    scope: data.scope,
    expiresAt:
      typeof data.expires_in === 'number'
        ? new Date(nowMs + usableLifetimeMs(data.expires_in))
        : null,
    refreshToken: data.refresh_token ?? null,
    refreshTokenExpiresAt:
      typeof data.refresh_token_expires_in === 'number'
        ? new Date(nowMs + data.refresh_token_expires_in * 1000)
        : null,
  }
}

async function postTokenRequest(shop: string, body: URLSearchParams): Promise<IssuedToken> {
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(
      `Shopify token request for ${shop} failed with ${res.status}: ${text.slice(0, 500)}`
    )
  }

  const data = (await res.json().catch(() => null)) as ShopifyTokenJson | null

  // A refused grant comes back as a 200 carrying `{"error": ...}` rather than an
  // error status, so `res.ok` on its own does not mean a token was issued.
  // Trusting it would persist `undefined` under a `string` type and surface far
  // from here — as `X-Shopify-Access-Token: undefined` on the next Admin API
  // call, or as a `TypeError` in a caller reading `scope`. The response is never
  // quoted back: on a partial body it could still hold token material.
  if (typeof data?.access_token !== 'string' || typeof data.scope !== 'string') {
    const reason = typeof data?.error === 'string' ? data.error : 'no access_token in the body'
    throw new Error(
      `Shopify token request for ${shop} answered ${res.status} without issuing a token: ${reason}`
    )
  }

  return toIssuedToken(data, Date.now())
}

/**
 * Exchanges an App Bridge session token for an *expiring* offline access token.
 *
 * `expiring=1` opts into the 60-minute access token and 90-day refresh token
 * pair. Without it Shopify issues a legacy non-expiring `shpat_*` token, which
 * the Admin API now rejects with 403.
 *
 * @see https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/offline-access-tokens
 */
export function exchangeForOfflineToken(
  shop: string,
  sessionToken: string,
  apiKey: string,
  apiSecret: string
): Promise<IssuedToken> {
  return postTokenRequest(
    shop,
    new URLSearchParams({
      client_id: apiKey,
      client_secret: apiSecret,
      grant_type: TOKEN_EXCHANGE_GRANT_TYPE,
      subject_token: sessionToken,
      subject_token_type: ID_TOKEN_TYPE,
      requested_token_type: OFFLINE_ACCESS_TOKEN_TYPE,
      expiring: '1',
    })
  )
}

/**
 * Renews an expiring offline access token with a stored refresh token.
 *
 * Shopify invalidates the presented refresh token on success, so the newly
 * issued pair must always replace what was stored.
 */
export function refreshAccessToken(
  shop: string,
  refreshToken: string,
  apiKey: string,
  apiSecret: string
): Promise<IssuedToken> {
  return postTokenRequest(
    shop,
    new URLSearchParams({
      client_id: apiKey,
      client_secret: apiSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    })
  )
}

/** Whether the access token needs renewing before it can be used. */
export function isAccessTokenExpired(session: StoredShopifySession | null, now: Date): boolean {
  // A missing `expiresAt` means a legacy non-expiring token, which Shopify now
  // rejects. Treating it as expired lets pre-existing records heal themselves.
  return session === null || session.expiresAt === null || session.expiresAt <= now
}

/** Whether the stored refresh token can still be presented to Shopify. */
export function isRefreshTokenUsable(session: StoredShopifySession | null, now: Date): boolean {
  if (session === null || session.refreshToken === null) {
    return false
  }
  return session.refreshTokenExpiresAt === null || session.refreshTokenExpiresAt > now
}
