import type { SessionTokenPayload } from './types'

/**
 * Verify a Shopify App Bridge session token (JWT, HS256) using Web Crypto.
 *
 * @see https://shopify.dev/docs/apps/build/authentication-authorization/session-tokens
 */

export function base64UrlDecode(input: string): Uint8Array<ArrayBuffer> {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  const binary = atob(padded)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i)
  }
  return out
}

function decodeJsonSegment(segment: string): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlDecode(segment)))
  } catch {
    return null
  }
}

export interface VerifySessionTokenOptions {
  /** Tolerance applied to `exp` and `nbf`, in seconds. Defaults to 10. */
  leewaySeconds?: number
}

/**
 * Returns the verified claims, or `null` if the token is invalid for any
 * reason. Never throws and performs no I/O, so it is safe to call outside of a
 * request — in a queue consumer or scheduled job, for example.
 */
export async function verifyShopifySessionToken(
  token: string,
  apiKey: string,
  apiSecret: string,
  options: VerifySessionTokenOptions = {}
): Promise<SessionTokenPayload | null> {
  const leeway = options.leewaySeconds ?? 10
  const parts = token.split('.')
  if (parts.length !== 3) {
    return null
  }

  const [headerB64, payloadB64, signatureB64] = parts
  if (headerB64 === undefined || payloadB64 === undefined || signatureB64 === undefined) {
    return null
  }

  const header = decodeJsonSegment(headerB64) as { alg?: string; typ?: string } | null
  // Only HS256 is accepted. Rejecting here is what stops an `alg: none` token,
  // or one signed with an asymmetric key we would never have issued.
  if (header === null || header.alg !== 'HS256') {
    return null
  }

  const payload = decodeJsonSegment(payloadB64) as SessionTokenPayload | null
  if (payload === null) {
    return null
  }

  const now = Math.floor(Date.now() / 1000)
  if (typeof payload.exp !== 'number' || payload.exp + leeway < now) {
    return null
  }
  if (typeof payload.nbf === 'number' && payload.nbf - leeway > now) {
    return null
  }
  if (payload.aud !== apiKey) {
    return null
  }

  // `dest` must be an https URL on a myshopify.com host, and `iss` must agree
  // with it. Without this a valid signature over an attacker-chosen `dest`
  // would point subsequent Admin API calls at an arbitrary origin.
  let destUrl: URL
  let issUrl: URL
  try {
    destUrl = new URL(payload.dest)
    issUrl = new URL(payload.iss)
  } catch {
    return null
  }
  if (destUrl.protocol !== 'https:') {
    return null
  }
  if (!/\.myshopify\.com$/i.test(destUrl.hostname)) {
    return null
  }
  if (issUrl.hostname !== destUrl.hostname) {
    return null
  }

  // The only segment still undecoded at this point, and `atob` throws on
  // characters outside the base64 alphabet.
  let signature: Uint8Array<ArrayBuffer>
  try {
    signature = base64UrlDecode(signatureB64)
  } catch {
    return null
  }

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(apiSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  )
  const verified = await crypto.subtle.verify(
    'HMAC',
    key,
    signature,
    new TextEncoder().encode(`${headerB64}.${payloadB64}`)
  )
  if (!verified) {
    return null
  }

  return payload
}

/** Extracts the shop domain (e.g. `example.myshopify.com`) from verified claims. */
export function shopFromPayload(payload: SessionTokenPayload): string {
  return new URL(payload.dest).hostname.toLowerCase()
}
