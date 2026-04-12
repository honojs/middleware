import type { Context, MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'

export type CloudflareAccessPayload = {
  aud: string | string[]
  email?: string
  exp: number
  iat: number
  nbf?: number
  iss: string
  type?: string
  identity_nonce?: string
  sub?: string
  country?: string
}

export type CloudflareAccessVariables = {
  accessPayload: CloudflareAccessPayload
}

type DecodedToken = {
  header: { alg: string; typ?: string; kid?: string; crit?: string[] }
  payload: CloudflareAccessPayload
  signature: Uint8Array
  raw: { header?: string; payload?: string; signature?: string }
}

declare module 'hono' {
  interface ContextVariableMap {
    accessPayload: CloudflareAccessPayload
  }
}

export const cloudflareAccess = (
  accessTeamName: string,
  aud?: string | string[]
): MiddlewareHandler => {
  if (!/^[a-zA-Z0-9-]+$/.test(accessTeamName)) {
    throw new Error('Invalid accessTeamName: must contain only alphanumeric characters and hyphens')
  }
  accessTeamName = accessTeamName.toLowerCase()

  const allowedAuds = aud ? (Array.isArray(aud) ? aud : [aud]) : []

  if (allowedAuds.length === 0) {
    console.warn(
      'cloudflare-access: No aud parameter provided. It is strongly recommended to pass your Application Audience (AUD) Tag to prevent cross-application token reuse.'
    )
  }

  // This var will hold already imported jwt keys, this reduces the load of importing the key on every request
  let cacheKeys: Record<string, CryptoKey> = {}
  let cacheExpiration = 0

  async function refreshKeys() {
    const publicKeys = await getPublicKeys(accessTeamName)
    cacheKeys = publicKeys.keys
    cacheExpiration = publicKeys.cacheExpiration
  }

  return createMiddleware(async (c, next) => {
    const encodedToken = getJwt(c)
    if (encodedToken === null) {
      return c.text('Authentication error: Missing bearer token', 401)
    }

    // Load jwt keys if they are not in memory or already expired
    if (Object.keys(cacheKeys).length === 0 || Math.floor(Date.now() / 1000) >= cacheExpiration) {
      await refreshKeys()
    }

    // Decode Token
    let token
    try {
      token = decodeJwt(encodedToken)
    } catch {
      return c.text('Authentication error: Unable to decode Bearer token', 401)
    }

    // Validate algorithm
    if (token.header.alg !== 'RS256') {
      return c.text('Authentication error: Invalid token algorithm', 401)
    }

    // RFC 7515 §4.1.11: Reject tokens with critical extensions we don't understand
    if (token.header.crit) {
      return c.text('Authentication error: Unsupported critical extension', 401)
    }

    // Validate payload structure
    if (typeof token.payload.exp !== 'number' || typeof token.payload.iss !== 'string') {
      return c.text('Authentication error: Malformed token payload', 401)
    }

    // Is signed from the correct team? (cheap check before expensive signature verification)
    const expectedIss = `https://${accessTeamName}.cloudflareaccess.com`
    if (token.payload.iss !== expectedIss) {
      return c.text('Authentication error: Invalid team name', 401)
    }

    // Is the token intended for the correct application?
    // RFC 7519 §4.1.3: both the token's aud and the configured aud may be string or array.
    // Normalize both to arrays and check for intersection.
    if (allowedAuds.length > 0) {
      const audClaim = token.payload.aud
      const tokenAuds = Array.isArray(audClaim) ? audClaim : [audClaim]
      if (!allowedAuds.some((a) => tokenAuds.includes(a))) {
        return c.text('Authentication error: Invalid token audience', 401)
      }
    }

    // Check if token is valid against at least one public key
    if (!(await isValidJwtSignature(token, cacheKeys))) {
      // Re-fetch JWKS and retry once if token has an unknown kid (key rotation mid-cache-period)
      if (token.header.kid && !cacheKeys[token.header.kid]) {
        await refreshKeys()
        if (!(await isValidJwtSignature(token, cacheKeys))) {
          return c.text('Authentication error: Invalid Token', 401)
        }
      } else {
        return c.text('Authentication error: Invalid Token', 401)
      }
    }

    // RFC 7519 §4.1.4-4.1.5: allow small leeway for clock skew across distributed systems
    const CLOCK_SKEW_SECONDS = 30
    const nowSeconds = Math.floor(Date.now() / 1000)

    // Is the token expired? (checked after signature to avoid trusting unverified claims)
    if (token.payload.exp + CLOCK_SKEW_SECONDS < nowSeconds) {
      return c.text('Authentication error: Token is expired', 401)
    }

    // Is the token not yet valid?
    if (token.payload.nbf && token.payload.nbf - CLOCK_SKEW_SECONDS > nowSeconds) {
      return c.text('Authentication error: Token is not yet valid', 401)
    }

    c.set('accessPayload', token.payload)
    await next()
  })
}

async function getPublicKeys(accessTeamName: string) {
  const jwtUrl = `https://${accessTeamName}.cloudflareaccess.com/cdn-cgi/access/certs`

  const result = await fetch(jwtUrl, {
    method: 'GET',
    cf: {
      // Dont cache error responses
      cacheTtlByStatus: { '200-299': 30, '300-599': 0 },
    },
  } as RequestInit)

  if (!result.ok) {
    if (result.status === 404) {
      throw new HTTPException(500, {
        message: `Authentication error: The Access Organization '${accessTeamName}' does not exist`,
      })
    }

    throw new HTTPException(500, {
      message: `Authentication error: Received unexpected HTTP code ${result.status} from Cloudflare Access`,
    })
  }

  const data = (await result.json()) as { keys: (JsonWebKey & { kid?: string })[] }

  // Because we keep CryptoKey's in memory between requests, we need to make sure they are refreshed once in a while
  const cacheExpiration = Math.floor(Date.now() / 1000) + 3600 // 1h

  const importedKeys: Record<string, CryptoKey> = {}
  for (const key of data.keys) {
    // Skip keys without kid — we need it to index into the cache for key selection
    if (!key.kid) {
      continue
    }
    // RFC 7517 §4.1-4.3: Only import RSA keys intended for signature verification
    if (key.kty !== 'RSA') {
      continue
    }
    if (key.use && key.use !== 'sig') {
      continue
    }
    // RFC 7517 §4.3: If key_ops is present, it must include "verify"
    if (key.key_ops && !key.key_ops.includes('verify')) {
      continue
    }
    importedKeys[key.kid] = await crypto.subtle.importKey(
      'jwk',
      key,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256',
      },
      false,
      ['verify']
    )
  }

  return {
    keys: importedKeys,
    cacheExpiration: cacheExpiration,
  }
}

function getJwt(c: Context) {
  const jwt = c.req.header('cf-access-jwt-assertion') ?? getCookie(c, 'CF_Authorization')
  if (!jwt) {
    return null
  }
  return jwt.trim()
}

function base64urlDecode(str: string): string {
  // RFC 7515 §5.2: reject base64url strings with whitespace, line breaks, or invalid characters
  if (!/^[A-Za-z0-9_-]*$/.test(str)) {
    throw new Error('Invalid base64url encoding')
  }
  str = str.replace(/-/g, '+').replace(/_/g, '/')
  // Restore padding removed per RFC 7515 §2
  str += '='.repeat((4 - (str.length % 4)) % 4)
  const bytes = Uint8Array.from(atob(str), (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function base64urlDecodeToBytes(str: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(str)) {
    throw new Error('Invalid base64url encoding')
  }
  str = str.replace(/-/g, '+').replace(/_/g, '/')
  str += '='.repeat((4 - (str.length % 4)) % 4)
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0))
}

function decodeJwt(token: string): DecodedToken {
  const parts = token.split('.')
  if (parts.length !== 3) {
    throw new Error('Invalid token')
  }
  const [header, payload, signature] = parts

  return {
    header: JSON.parse(base64urlDecode(header)) as DecodedToken['header'],
    payload: JSON.parse(base64urlDecode(payload)) as CloudflareAccessPayload,
    signature: base64urlDecodeToBytes(signature),
    raw: { header, payload, signature },
  }
}

async function isValidJwtSignature(token: DecodedToken, keys: Record<string, CryptoKey>) {
  const encoder = new TextEncoder()
  const data = encoder.encode([token.raw.header, token.raw.payload].join('.'))

  const signature = token.signature

  // RFC 7515 §4.1.4: Use kid to select the verification key when present
  if (token.header.kid) {
    const key = keys[token.header.kid]
    if (key) {
      return validateSingleKey(key, signature, data)
    }
  }

  // Fall back to trying all keys only when kid is absent
  if (!token.header.kid) {
    for (const key of Object.values(keys)) {
      const isValid = await validateSingleKey(key, signature, data)

      if (isValid) {
        return true
      }
    }
  }

  return false
}

async function validateSingleKey(
  key: CryptoKey,
  signature: Uint8Array,
  data: Uint8Array
): Promise<boolean> {
  return crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    signature.buffer as ArrayBuffer,
    data.buffer as ArrayBuffer
  )
}
