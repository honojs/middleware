import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import crypto from 'crypto'
import { promisify } from 'util'
import { cloudflareAccess } from '.'

const generateKeyPair = promisify(crypto.generateKeyPair)

interface KeyPairResult {
  publicKey: string
  privateKey: string
}

interface JWK {
  kid: string
  kty: string
  alg: string
  use: string
  e: string
  n: string
}

async function generateJWTKeyPair(): Promise<KeyPairResult> {
  try {
    const { publicKey, privateKey } = await generateKeyPair('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    })

    return {
      publicKey,
      privateKey,
    }
  } catch (error) {
    throw new Error(`Failed to generate key pair: ${(error as Error).message}`)
  }
}

function generateKeyThumbprint(modulusBase64: string): string {
  const hash = crypto.createHash('sha256')
  hash.update(Buffer.from(modulusBase64, 'base64'))
  return hash.digest('hex')
}

function publicKeyToJWK(publicKey: string): JWK {
  // Convert PEM to key object
  const keyObject = crypto.createPublicKey(publicKey)

  // Export the key in JWK format
  const jwk = keyObject.export({ format: 'jwk' })

  // Generate key ID using the modulus
  const kid = generateKeyThumbprint(jwk.n as string)

  return {
    kid,
    kty: 'RSA',
    alg: 'RS256',
    use: 'sig',
    e: jwk.e as string,
    n: jwk.n as string,
  }
}

function base64URLEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

function generateJWTWithHeader(
  privateKey: string,
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  expiresIn: number = 3600
): string {
  const now = Math.floor(Date.now() / 1000)
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresIn,
  }

  const encodedHeader = base64URLEncode(JSON.stringify(header))
  const encodedPayload = base64URLEncode(JSON.stringify(fullPayload))

  const signatureInput = `${encodedHeader}.${encodedPayload}`
  const signer = crypto.createSign('RSA-SHA256')
  signer.update(signatureInput)
  const signature = signer.sign(privateKey)
  // @ts-expect-error signature is not typed correctly
  const encodedSignature = base64URLEncode(signature)

  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`
}

function generateJWT(
  privateKey: string,
  payload: Record<string, unknown>,
  expiresIn: number = 3600
): string {
  // Create header
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  }

  // Add expiration to payload
  const now = Math.floor(Date.now() / 1000)
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresIn,
  }

  // Encode header and payload
  const encodedHeader = base64URLEncode(JSON.stringify(header))
  const encodedPayload = base64URLEncode(JSON.stringify(fullPayload))

  // Create signature
  const signatureInput = `${encodedHeader}.${encodedPayload}`
  const signer = crypto.createSign('RSA-SHA256')
  signer.update(signatureInput)
  const signature = signer.sign(privateKey)
  // @ts-expect-error signature is not typed correctly
  const encodedSignature = base64URLEncode(signature)

  // Combine all parts
  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`
}

describe('Cloudflare Access middleware', async () => {
  const keyPair1 = await generateJWTKeyPair()
  const keyPair2 = await generateJWTKeyPair()
  const keyPair3 = await generateJWTKeyPair()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', () => {
      return Response.json({
        keys: [publicKeyToJWK(keyPair1.publicKey), publicKeyToJWK(keyPair2.publicKey)],
      })
    })
  })

  const app = new Hono()

  app.use('/*', cloudflareAccess('my-cool-team-name'))
  app.get('/hello-behind-access', (c) => c.text('foo'))
  app.get('/access-payload', (c) => c.json(c.get('accessPayload')))

  app.onError((err, c) => {
    return c.json(
      {
        err: err.toString(),
      },
      500
    )
  })

  it('Should throw Missing bearer token when nothing is sent', async () => {
    const res = await app.request('http://localhost/hello-behind-access')
    expect(res).not.toBeNull()
    expect(res.status).toBe(401)
    expect(await res.text()).toBe('Authentication error: Missing bearer token')
  })

  it('Should throw Unable to decode Bearer token when sending garbage', async () => {
    const res = await app.request('http://localhost/hello-behind-access', {
      headers: {
        'cf-access-jwt-assertion': 'asdasdasda',
      },
    })
    expect(res).not.toBeNull()
    expect(res.status).toBe(401)
    expect(await res.text()).toBe('Authentication error: Unable to decode bearer token')
  })

  it('Should throw Token is expired when sending expired token', async () => {
    const token = generateJWT(
      keyPair1.privateKey,
      {
        sub: '1234567890',
        iss: 'https://my-cool-team-name.cloudflareaccess.com',
      },
      -3600
    )

    const res = await app.request('http://localhost/hello-behind-access', {
      headers: {
        'cf-access-jwt-assertion': token,
      },
    })
    expect(res).not.toBeNull()
    expect(res.status).toBe(401)
    expect(await res.text()).toBe('Authentication error: Token is expired')
  })

  it('Should throw Invalid team name when sending invalid iss', async () => {
    const token = generateJWT(keyPair1.privateKey, {
      sub: '1234567890',
      iss: 'https://different-team.cloudflareaccess.com',
    })

    const res = await app.request('http://localhost/hello-behind-access', {
      headers: {
        'cf-access-jwt-assertion': token,
      },
    })
    expect(res).not.toBeNull()
    expect(res.status).toBe(401)
    expect(await res.text()).toBe('Authentication error: Invalid team name')
  })

  it('Should throw Invalid token when sending token signed with private key not in the allowed list', async () => {
    const token = generateJWT(keyPair3.privateKey, {
      sub: '1234567890',
      iss: 'https://my-cool-team-name.cloudflareaccess.com',
    })

    const res = await app.request('http://localhost/hello-behind-access', {
      headers: {
        'cf-access-jwt-assertion': token,
      },
    })
    expect(res).not.toBeNull()
    expect(res.status).toBe(401)
    expect(await res.text()).toBe('Authentication error: Invalid token')
  })

  it('Should work when sending everything correctly', async () => {
    const token = generateJWT(keyPair1.privateKey, {
      sub: '1234567890',
      iss: 'https://my-cool-team-name.cloudflareaccess.com',
    })

    const res = await app.request('http://localhost/hello-behind-access', {
      headers: {
        'cf-access-jwt-assertion': token,
      },
    })
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('foo')
  })

  it('Should work when sending jwt as a Cookie', async () => {
    const token = generateJWT(keyPair1.privateKey, {
      sub: '1234567890',
      iss: 'https://my-cool-team-name.cloudflareaccess.com',
    })

    const res = await app.request('http://localhost/hello-behind-access', {
      headers: {
        Cookie: `CF_Authorization=${token}`,
      },
    })
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('foo')
  })

  it('Should work with tokens signed by the 2º key in the public keys list', async () => {
    const token = generateJWT(keyPair2.privateKey, {
      sub: '1234567890',
      iss: 'https://my-cool-team-name.cloudflareaccess.com',
    })

    const res = await app.request('http://localhost/hello-behind-access', {
      headers: {
        'cf-access-jwt-assertion': token,
      },
    })
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('foo')
  })

  it('Should reject token with wrong audience when aud is configured', async () => {
    const appWithAud = new Hono()
    appWithAud.use('/*', cloudflareAccess('my-cool-team-name', 'expected-aud-tag'))
    appWithAud.get('/hello-behind-access', (c) => c.text('foo'))

    const token = generateJWT(keyPair1.privateKey, {
      sub: '1234567890',
      iss: 'https://my-cool-team-name.cloudflareaccess.com',
      aud: ['wrong-aud-tag'],
    })

    const res = await appWithAud.request('http://localhost/hello-behind-access', {
      headers: {
        'cf-access-jwt-assertion': token,
      },
    })
    expect(res).not.toBeNull()
    expect(res.status).toBe(401)
    expect(await res.text()).toBe('Authentication error: Invalid token audience')
  })

  it('Should accept token with correct audience when aud is configured', async () => {
    const appWithAud = new Hono()
    appWithAud.use('/*', cloudflareAccess('my-cool-team-name', 'expected-aud-tag'))
    appWithAud.get('/hello-behind-access', (c) => c.text('foo'))

    const token = generateJWT(keyPair1.privateKey, {
      sub: '1234567890',
      iss: 'https://my-cool-team-name.cloudflareaccess.com',
      aud: ['expected-aud-tag'],
    })

    const res = await appWithAud.request('http://localhost/hello-behind-access', {
      headers: {
        'cf-access-jwt-assertion': token,
      },
    })
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('foo')
  })

  it('Should skip audience check when aud is not configured', async () => {
    const token = generateJWT(keyPair1.privateKey, {
      sub: '1234567890',
      iss: 'https://my-cool-team-name.cloudflareaccess.com',
      aud: ['any-aud-tag'],
    })

    const res = await app.request('http://localhost/hello-behind-access', {
      headers: {
        'cf-access-jwt-assertion': token,
      },
    })
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('foo')
  })

  it('Should be able to retrieve the JWT payload from Hono context', async () => {
    const token = generateJWT(keyPair1.privateKey, {
      sub: '1234567890',
      iss: 'https://my-cool-team-name.cloudflareaccess.com',
    })

    const res = await app.request('http://localhost/access-payload', {
      headers: {
        'cf-access-jwt-assertion': token,
      },
    })
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      sub: '1234567890',
      iss: 'https://my-cool-team-name.cloudflareaccess.com',
      iat: expect.any(Number) as number,
      exp: expect.any(Number) as number,
    })
  })

  it('Should throw an error, if the access organization does not exist', async () => {
    vi.stubGlobal('fetch', () => {
      return Response.json({ success: false }, { status: 404 })
    })

    // Use a fresh app so the middleware has no cached keys
    const freshApp = new Hono()
    freshApp.use('/*', cloudflareAccess('my-cool-team-name'))
    freshApp.get('/hello-behind-access', (c) => c.text('foo'))
    freshApp.onError((err, c) => c.json({ err: err.toString() }, 500))

    const res = await freshApp.request('http://localhost/hello-behind-access', {
      headers: {
        'cf-access-jwt-assertion': 'asdads',
      },
    })
    expect(res).not.toBeNull()
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({
      err: "Error: Authentication error: The Access Organization 'my-cool-team-name' does not exist",
    })
  })

  it('Should throw an error, if the access certs url is unavailable', async () => {
    vi.stubGlobal('fetch', () => {
      return Response.json({ success: false }, { status: 500 })
    })

    // Use a fresh app so the middleware has no cached keys
    const freshApp = new Hono()
    freshApp.use('/*', cloudflareAccess('my-cool-team-name'))
    freshApp.get('/hello-behind-access', (c) => c.text('foo'))
    freshApp.onError((err, c) => c.json({ err: err.toString() }, 500))

    const res = await freshApp.request('http://localhost/hello-behind-access', {
      headers: {
        'cf-access-jwt-assertion': 'asdads',
      },
    })
    expect(res).not.toBeNull()
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({
      err: 'Error: Authentication error: Received unexpected HTTP code 500 from Cloudflare Access',
    })
  })

  it('Should reject token with future nbf', async () => {
    const now = Math.floor(Date.now() / 1000)
    const token = generateJWT(keyPair1.privateKey, {
      sub: '1234567890',
      iss: 'https://my-cool-team-name.cloudflareaccess.com',
      nbf: now + 3600, // 1 hour in the future
    })

    const res = await app.request('http://localhost/hello-behind-access', {
      headers: {
        'cf-access-jwt-assertion': token,
      },
    })
    expect(res).not.toBeNull()
    expect(res.status).toBe(401)
    expect(await res.text()).toBe('Authentication error: Token is not yet valid')
  })

  it('Should reject token with non-RS256 algorithm', async () => {
    const token = generateJWTWithHeader(
      keyPair1.privateKey,
      { alg: 'HS256', typ: 'JWT' },
      {
        sub: '1234567890',
        iss: 'https://my-cool-team-name.cloudflareaccess.com',
      }
    )

    const res = await app.request('http://localhost/hello-behind-access', {
      headers: {
        'cf-access-jwt-assertion': token,
      },
    })
    expect(res).not.toBeNull()
    expect(res.status).toBe(401)
    expect(await res.text()).toBe('Authentication error: Invalid token algorithm')
  })

  it('Should reject token with missing exp', async () => {
    // Manually construct a token without exp
    const header = base64URLEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
    const payload = base64URLEncode(
      JSON.stringify({
        sub: '1234567890',
        iss: 'https://my-cool-team-name.cloudflareaccess.com',
        iat: Math.floor(Date.now() / 1000),
      })
    )
    const signatureInput = `${header}.${payload}`
    const signer = crypto.createSign('RSA-SHA256')
    signer.update(signatureInput)
    const signature = signer.sign(keyPair1.privateKey)
    // @ts-expect-error signature is not typed correctly
    const encodedSignature = base64URLEncode(signature)
    const token = `${header}.${payload}.${encodedSignature}`

    const res = await app.request('http://localhost/hello-behind-access', {
      headers: {
        'cf-access-jwt-assertion': token,
      },
    })
    expect(res).not.toBeNull()
    expect(res.status).toBe(401)
    expect(await res.text()).toBe('Authentication error: Malformed token payload')
  })

  it('Should re-fetch keys after cache expiration', async () => {
    const fetchSpy = vi.fn(() =>
      Promise.resolve(
        Response.json({
          keys: [publicKeyToJWK(keyPair1.publicKey), publicKeyToJWK(keyPair2.publicKey)],
        })
      )
    )
    vi.stubGlobal('fetch', fetchSpy)

    const freshApp = new Hono()
    freshApp.use('/*', cloudflareAccess('my-cool-team-name'))
    freshApp.get('/hello-behind-access', (c) => c.text('foo'))

    const token = generateJWT(keyPair1.privateKey, {
      sub: '1234567890',
      iss: 'https://my-cool-team-name.cloudflareaccess.com',
    })

    // First request fetches keys
    await freshApp.request('http://localhost/hello-behind-access', {
      headers: { 'cf-access-jwt-assertion': token },
    })
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    // Second request uses cache
    await freshApp.request('http://localhost/hello-behind-access', {
      headers: { 'cf-access-jwt-assertion': token },
    })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('Should throw when accessTeamName contains invalid characters', () => {
    expect(() => cloudflareAccess('my team/name')).toThrow(
      'Invalid accessTeamName: must contain only alphanumeric characters and hyphens'
    )
    expect(() => cloudflareAccess('team.name')).toThrow()
    expect(() => cloudflareAccess('')).toThrow()
  })

  it('Should warn when aud is omitted', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    cloudflareAccess('my-cool-team-name')
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('No aud parameter provided')
    )
    warnSpy.mockRestore()
  })

  it('Should not warn when aud is provided', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    cloudflareAccess('my-cool-team-name', 'my-aud-tag')
    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('Should return generic error for issuer mismatch without leaking details', async () => {
    const token = generateJWT(keyPair1.privateKey, {
      sub: '1234567890',
      iss: 'https://attacker-team.cloudflareaccess.com',
    })

    const res = await app.request('http://localhost/hello-behind-access', {
      headers: {
        'cf-access-jwt-assertion': token,
      },
    })
    const text = await res.text()
    expect(text).toBe('Authentication error: Invalid team name')
    expect(text).not.toContain('attacker-team')
    expect(text).not.toContain('my-cool-team-name')
  })

  it('Should correctly decode tokens with base64url characters in payload', async () => {
    const token = generateJWT(keyPair1.privateKey, {
      sub: 'user+test/special_chars',
      iss: 'https://my-cool-team-name.cloudflareaccess.com',
    })

    const res = await app.request('http://localhost/access-payload', {
      headers: {
        'cf-access-jwt-assertion': token,
      },
    })
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.sub).toBe('user+test/special_chars')
  })
})
