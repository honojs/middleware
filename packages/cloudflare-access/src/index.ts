import type { Context, MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'

export type CloudflareAccessPayload = {
  aud: string[]
  email: string
  exp: number
  iat: number
  nbf: number
  iss: string
  type: string
  identity_nonce: string
  sub: string
  country: string
}

export type CloudflareAccessVariables = {
  accessPayload: CloudflareAccessPayload
}

type DecodedToken = {
  header: object
  payload: CloudflareAccessPayload
  signature: string
  raw: { header?: string; payload?: string; signature?: string }
}

declare module 'hono' {
  interface ContextVariableMap {
    accessPayload: CloudflareAccessPayload
  }
}

export const cloudflareAccess = (accessTeamName: string): MiddlewareHandler => {
  // This var will hold already imported jwt keys, this reduces the load of importing the key on every request
  let cacheKeys: Record<string, CryptoKey> = {}
  let cacheExpiration = 0

  return createMiddleware(async (c, next) => {
    const encodedToken = getJwt(c)
    if (encodedToken === null) {
      return c.text('Authentication error: Missing bearer token', 401)
    }

    // Load jwt keys if they are not in memory or already expired
    if (Object.keys(cacheKeys).length === 0 || Math.floor(Date.now() / 1000) < cacheExpiration) {
      const publicKeys = await getPublicKeys(accessTeamName)
      cacheKeys = publicKeys.keys
      cacheExpiration = publicKeys.cacheExpiration
    }

    // Decode Token
    let token
    try {
      token = decodeJwt(encodedToken)
    } catch (err) {
      return c.text('Authentication error: Unable to decode Bearer token', 401)
    }

    // Is the token expired?
    const expiryDate = new Date(token.payload.exp * 1000)
    const currentDate = new Date(Date.now())
    if (expiryDate <= currentDate) {
      return c.text('Authentication error: Token is expired', 401)
    }

    // Check is token is valid against at least one public key?
    if (!(await isValidJwtSignature(token, cacheKeys))) {
      return c.text('Authentication error: Invalid Token', 401)
    }

    // Is signed from the correct team?
    const expectedIss = `https://${accessTeamName}.cloudflareaccess.com`
    if (token.payload?.iss !== expectedIss) {
      return c.text(
        `Authentication error: Expected team name ${expectedIss}, but received ${token.payload?.iss}`,
        401
      )
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

  const data: any = await result.json()

  // Because we keep CryptoKey's in memory between requests, we need to make sure they are refreshed once in a while
  const cacheExpiration = Math.floor(Date.now() / 1000) + 3600 // 1h

  const importedKeys: Record<string, CryptoKey> = {}
  for (const key of data.keys) {
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

function decodeJwt(token: string): DecodedToken {
  const parts = token.split('.')
  if (parts.length !== 3) {
    throw new Error('Invalid token')
  }

  const header = JSON.parse(atob(parts[0] as string))
  const payload = JSON.parse(atob(parts[1] as string))
  const signature = atob((parts[2] as string).replace(/_/g, '/').replace(/-/g, '+'))

  return {
    header: header,
    payload: payload,
    signature: signature,
    raw: { header: parts[0], payload: parts[1], signature: parts[2] },
  }
}

async function isValidJwtSignature(token: DecodedToken, keys: Record<string, CryptoKey>) {
  const encoder = new TextEncoder()
  const data = encoder.encode([token.raw.header, token.raw.payload].join('.'))

  const signature = new Uint8Array(Array.from(token.signature).map((c) => c.charCodeAt(0)))

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
  signature: Uint8Array,
  data: Uint8Array
): Promise<boolean> {
  return crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, data)
}
