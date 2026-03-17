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
  signature: string
  raw: { header?: string; payload?: string; signature?: string }
}

declare module 'hono' {
  interface ContextVariableMap {
    accessPayload: CloudflareAccessPayload
  }
}

export const cloudflareAccess = (accessTeamName: string, aud?: string): MiddlewareHandler => {
  if (!/^[a-zA-Z0-9-]+$/.test(accessTeamName)) {
    throw new Error('Invalid accessTeamName: must contain only alphanumeric characters and hyphens')
  }

  if (!aud) {
    console.warn(
      'cloudflare-access: No aud parameter provided. It is strongly recommended to pass your Application Audience (AUD) Tag to prevent cross-application token reuse.'
    )
  }

  // This var will hold already imported jwt keys, this reduces the load of importing the key on every request
  let cacheKeys: Record<string, CryptoKey> = {}
  let cacheExpiration = 0

  return createMiddleware(async (c, next) => {
    const encodedToken = getJwt(c)
    if (encodedToken === null) {
      return c.text('Authentication error: Missing bearer token', 401)
    }

    // Load jwt keys if they are not in memory or already expired
    if (Object.keys(cacheKeys).length === 0 || Math.floor(Date.now() / 1000) >= cacheExpiration) {
      const publicKeys = await getPublicKeys(accessTeamName)
      cacheKeys = publicKeys.keys
      cacheExpiration = publicKeys.cacheExpiration
    }

    // Decode Token
    let token
    try {
      token = decodeJwt(encodedToken)
    } catch {
      return c.text('Authentication error: Unable to decode bearer token', 401)
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
    // RFC 7519 §4.1.3: aud may be a string or an array of strings — normalize to array
    // to avoid String.prototype.includes() substring matching vulnerability
    if (aud) {
      const audClaim = token.payload.aud
      const audArray = Array.isArray(audClaim) ? audClaim : [audClaim]
      if (!audArray.includes(aud)) {
        return c.text('Authentication error: Invalid token audience', 401)
      }
    }

    // Check is token is valid against at least one public key?
    if (!(await isValidJwtSignature(token, cacheKeys))) {
      return c.text('Authentication error: Invalid token', 401)
    }

    // Is the token expired? (checked after signature to avoid trusting unverified claims)
    const expiryDate = new Date(token.payload.exp * 1000)
    const currentDate = new Date(Date.now())
    if (expiryDate <= currentDate) {
      return c.text('Authentication error: Token is expired', 401)
    }

    // Is the token not yet valid?
    if (token.payload.nbf && token.payload.nbf * 1000 > Date.now()) {
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
  })

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

  const data = await result.json<{ keys: (JsonWebKey & { kid?: string })[] }>()

  // Because we keep CryptoKey's in memory between requests, we need to make sure they are refreshed once in a while
  const cacheExpiration = Math.floor(Date.now() / 1000) + 3600 // 1h

  const importedKeys: Record<string, CryptoKey> = {}
  for (const key of data.keys) {
    // RFC 7517 §4.5: kid MUST be present for key selection to work
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
  str = str.replace(/-/g, '+').replace(/_/g, '/')
  // Restore padding removed per RFC 7515 §2
  str += '='.repeat((4 - (str.length % 4)) % 4)
  return atob(str)
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
    signature: base64urlDecode(signature),
    raw: { header, payload, signature },
  }
}

async function isValidJwtSignature(token: DecodedToken, keys: Record<string, CryptoKey>) {
  const encoder = new TextEncoder()
  const data = encoder.encode([token.raw.header, token.raw.payload].join('.'))

  const signature = new Uint8Array(Array.from(token.signature).map((c) => c.charCodeAt(0)))

  // RFC 7515 §4.1.4: Use kid to select the verification key when present
  if (token.header.kid) {
    const key = keys[token.header.kid]
    if (key) {
      return validateSingleKey(key, signature, data)
    }
  }

  // Fall back to trying all keys when kid is absent or not found
  for (const key of Object.values(keys)) {
    const isValid = await validateSingleKey(key, signature, data)

    if (isValid) {
      return true
    }
  }

  return false
}

async function validateSingleKey(
  key: CryptoKey,
  signature: BufferSource,
  data: BufferSource
): Promise<boolean> {
  return crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, data)
}
