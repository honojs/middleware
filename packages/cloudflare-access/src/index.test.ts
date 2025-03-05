import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'

import crypto from 'crypto'
import { promisify } from 'util'
import { cloudflareAccess } from '../src'

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

function generateJWT(
  privateKey: string,
  payload: Record<string, any>,
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
    vi.stubGlobal('fetch', async () => {
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

  it('Should be throw Missing bearer token when nothing is sent', async () => {
    const res = await app.request('http://localhost/hello-behind-access')
    expect(res).not.toBeNull()
    expect(res.status).toBe(401)
    expect(await res.text()).toBe('Authentication error: Missing bearer token')
  })

  it('Should be throw Unable to decode Bearer token when sending garbage', async () => {
    const res = await app.request('http://localhost/hello-behind-access', {
      headers: {
        'cf-access-jwt-assertion': 'asdasdasda',
      },
    })
    expect(res).not.toBeNull()
    expect(res.status).toBe(401)
    expect(await res.text()).toBe('Authentication error: Unable to decode Bearer token')
  })

  it('Should be throw Token is expired when sending expired token', async () => {
    const token = generateJWT(
      keyPair1.privateKey,
      {
        sub: '1234567890',
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

  it('Should be throw Expected team name x, but received y when sending invalid iss', async () => {
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
    expect(await res.text()).toBe(
      'Authentication error: Expected team name https://my-cool-team-name.cloudflareaccess.com, but received https://different-team.cloudflareaccess.com'
    )
  })

  it('Should be throw Invalid token when sending token signed with private key not in the allowed list', async () => {
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
    expect(await res.text()).toBe('Authentication error: Invalid Token')
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
      iat: expect.any(Number),
      exp: expect.any(Number),
    })
  })

  it('Should throw an error, if the access organization does not exist', async () => {
    vi.stubGlobal('fetch', async () => {
      return Response.json({ success: false }, { status: 404 })
    })

    const res = await app.request('http://localhost/hello-behind-access', {
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
    vi.stubGlobal('fetch', async () => {
      return Response.json({ success: false }, { status: 500 })
    })

    const res = await app.request('http://localhost/hello-behind-access', {
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
})
