import * as jose from 'jose'
import { JWTExpired } from 'jose/errors'

/**
 * JWE Key Management Algorithm
 *
 * @see {@link https://github.com/panva/jose/issues/210#jwe-alg}
 */
const ALG = 'dir' // Direct Encryption Mode with a shared secret

/**
 * JWE Content Encryption Algorithm
 *
 * @see {@link https://github.com/panva/jose/issues/210#jwe-enc}
 */
const ENC = 'A256GCM' // Requires a 256 bit (32 byte) secret
const BYTE_LENGTH = 32
/** Digest algorithm */
const HKDF_ALGORITHM: HkdfParams = {
  hash: 'SHA-256',
  /** Additional information to derive the encryption key */
  info: new TextEncoder().encode('session jwe cek'),
  name: 'HKDF',
  salt: new Uint8Array(0),
}

async function hdkf(secret: string) {
  const ikm = new TextEncoder().encode(secret)
  const length = BYTE_LENGTH << 3
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits(HKDF_ALGORITHM, key, length))
}

export type EncryptionKey = jose.CryptoKey | jose.KeyObject | jose.JWK | Uint8Array

/**
 * Create an encryption key from a shared secret or return the existing encryption key.
 */
export async function createEncryptionKey(secret: EncryptionKey | string): Promise<EncryptionKey> {
  if (typeof secret === 'string') {
    return hdkf(secret)
  }

  return secret
}

export interface CookiePayload extends jose.JWTPayload {}

export interface DecryptResult<Payload> extends Partial<jose.JWTDecryptResult<Payload>> {
  /**
   * Indicates that the JWT has expired.
   */
  expired: jose.errors.JWTExpired | undefined
}

/**
 * Decrypt and validate the JWE string
 */
export async function jweDecrypt<Payload>(
  jwt: string,
  key: EncryptionKey,
  options?: jose.JWTDecryptOptions
): Promise<DecryptResult<Payload>> {
  let expired
  let result

  try {
    result = await jose.jwtDecrypt<Payload>(jwt, key, options)
  } catch (error) {
    if (error instanceof JWTExpired) {
      expired = error
    } else {
      // Ignore other errors when decrypting the cookie, eg;
      // when the cookie is invalid.
      console.error(error)
    }
  }

  return { expired, ...result }
}

/**
 * Encrypt the cookie payload as a JWE string
 *
 * @returns the JWE string and the max age of the session cookie.
 */
export async function jweEncrypt(
  payload: CookiePayload,
  key: EncryptionKey,
  duration?: MaxAgeDuration
): Promise<{ jwe: string; maxAge?: number }> {
  const now = epoch()
  const iat = payload.iat ?? now
  const jwt = new jose.EncryptJWT(payload)
    .setIssuedAt(iat)
    .setProtectedHeader({ enc: ENC, alg: ALG })

  let maxAge

  if (duration) {
    const exp = calculateExpiration(iat, now, duration)
    maxAge = Math.max(0, exp - now)
    jwt.setExpirationTime(exp)
  }

  const jwe = await jwt.encrypt(key)

  return { jwe, maxAge }
}

/**
 * Generates a random byte hex string, encoded with base64.
 *
 * See [Generating random values](https://thecopenhagenbook.com/random-values)
 */
export function generateId(length = 20): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  // TODO: return bytes.toBase64()
  return btoa(Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(''))
}

/**
 * Time since unix epoch in seconds.
 */
export function epoch(date: Date = new Date()): number {
  return Math.floor(date.getTime() / 1000)
}

export interface MaxAgeDuration {
  /**
   * Duration a session will be valid for,
   * after which it will have to be re-authenticated.
   */
  absolute: number

  /**
   * Duration a session will be considered active,
   * during which the session max age can be extended.
   */
  inactivity?: number
}

/**
 * Calculate the expiration of the session cookie.
 *
 * Either the:
 * - last updated time + inactivity duration
 * - created time + absolute duration
 *
 * whichever is sooner
 */
function calculateExpiration(createdAt: number, updatedAt: number, duration: MaxAgeDuration) {
  if (duration.inactivity === undefined) {
    return createdAt + duration.absolute
  }

  return Math.min(updatedAt + duration.inactivity, createdAt + duration.absolute)
}
