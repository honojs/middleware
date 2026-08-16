import type { SessionTokenPayload } from './types'

/**
 * Helpers for producing genuine Shopify credentials in tests.
 *
 * Session tokens are HS256 and webhook signatures are HMAC-SHA256 — both
 * symmetric — so a test that knows the secret can mint real, valid credentials.
 * Nothing in the verification path needs to be mocked.
 */

export const API_KEY = 'test-api-key'
export const API_SECRET = 'test-api-secret'
export const SHOP = 'example.myshopify.com'

function base64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function hmacKey(secret: string, usage: 'sign' | 'verify'): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    [usage]
  )
}

/** Claims for a token that is valid right now, overridable per test. */
export function sessionPayload(overrides: Partial<SessionTokenPayload> = {}): SessionTokenPayload {
  const now = Math.floor(Date.now() / 1000)
  return {
    iss: `https://${SHOP}/admin`,
    dest: `https://${SHOP}`,
    aud: API_KEY,
    sub: '1',
    exp: now + 60,
    nbf: now - 60,
    iat: now - 60,
    jti: 'test-jti',
    ...overrides,
  }
}

/** Signs a session token. Pass `header` to forge `alg`, or `secret` to sign with the wrong key. */
export async function signSessionToken(
  payload: Partial<SessionTokenPayload> = {},
  options: { secret?: string; header?: Record<string, unknown> } = {}
): Promise<string> {
  const encoder = new TextEncoder()
  const header = base64Url(
    encoder.encode(JSON.stringify(options.header ?? { alg: 'HS256', typ: 'JWT' }))
  )
  const body = base64Url(encoder.encode(JSON.stringify(sessionPayload(payload))))
  const key = await hmacKey(options.secret ?? API_SECRET, 'sign')
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`${header}.${body}`))
  return `${header}.${body}.${base64Url(new Uint8Array(signature))}`
}

/** Computes the `X-Shopify-Hmac-Sha256` value Shopify would send for a body. */
export async function signWebhook(body: string, secret: string = API_SECRET): Promise<string> {
  const key = await hmacKey(secret, 'sign')
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
}

/** A request carrying a freshly signed session token. */
export async function authorizedRequest(
  path = 'http://localhost/api/test',
  payload: Partial<SessionTokenPayload> = {}
): Promise<Request> {
  return new Request(path, {
    headers: { Authorization: `Bearer ${await signSessionToken(payload)}` },
  })
}

/** A webhook request with a valid signature over `body`. */
export async function webhookRequest(
  body: string,
  headers: Record<string, string> = {}
): Promise<Request> {
  return new Request('http://localhost/webhooks/test', {
    method: 'POST',
    headers: {
      'X-Shopify-Hmac-Sha256': await signWebhook(body),
      'X-Shopify-Shop-Domain': SHOP,
      'X-Shopify-Topic': 'orders/fulfilled',
      ...headers,
    },
    body,
  })
}

/** A Shopify token endpoint response body. */
export function tokenResponse(overrides: Record<string, unknown> = {}): Response {
  return Response.json({
    access_token: 'shpua_new_token',
    scope: 'read_products',
    expires_in: 3600,
    refresh_token: 'refresh_new',
    refresh_token_expires_in: 7_776_000,
    ...overrides,
  })
}
