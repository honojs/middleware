import { shopFromPayload, verifyShopifySessionToken } from './session-token'
import { API_KEY, API_SECRET, SHOP, sessionPayload, signSessionToken } from './test-utils'
import type { SessionTokenPayload } from './types'

const verify = (token: string, options?: { leewaySeconds?: number }) =>
  verifyShopifySessionToken(token, API_KEY, API_SECRET, options)

const now = () => Math.floor(Date.now() / 1000)

const base64Url = (value: string) =>
  btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

describe('verifyShopifySessionToken', () => {
  it('accepts a well-formed token', async () => {
    const payload = await verify(await signSessionToken())
    expect(payload).not.toBeNull()
    expect(payload?.aud).toBe(API_KEY)
    expect(payload?.dest).toBe(`https://${SHOP}`)
  })

  describe('signature', () => {
    it('rejects a token signed with a different secret', async () => {
      expect(await verify(await signSessionToken({}, { secret: 'not-our-secret' }))).toBeNull()
    })

    it('rejects a tampered payload', async () => {
      const [header, , signature] = (await signSessionToken()).split('.')
      const forged = base64Url(
        JSON.stringify(sessionPayload({ dest: 'https://evil.myshopify.com' }))
      )
      expect(await verify(`${header}.${forged}.${signature}`)).toBeNull()
    })
  })

  // Only HS256 is ever legitimate — Shopify signs with the app's shared secret —
  // so anything else is either a forgery attempt or a token we never issued.
  it.each([
    ['alg: none', { alg: 'none', typ: 'JWT' }],
    ['an asymmetric alg', { alg: 'RS256', typ: 'JWT' }],
    ['no alg at all', { typ: 'JWT' }],
  ])('rejects a header with %s', async (_label, header) => {
    expect(await verify(await signSessionToken({}, { header }))).toBeNull()
  })

  describe('lifetime', () => {
    it.each<[string, () => Partial<SessionTokenPayload>]>([
      ['an expired token', () => ({ exp: now() - 120 })],
      ['a token that is not yet valid', () => ({ nbf: now() + 120 })],
    ])('rejects %s', async (_label, claims) => {
      expect(await verify(await signSessionToken(claims()))).toBeNull()
    })

    it.each<[string, () => Partial<SessionTokenPayload>]>([
      ['exp', () => ({ exp: now() - 5 })],
      ['nbf', () => ({ nbf: now() + 5 })],
    ])('accepts a token whose %s falls within the default leeway', async (_label, claims) => {
      expect(await verify(await signSessionToken(claims()))).not.toBeNull()
    })

    it('honours a custom leeway', async () => {
      const token = await signSessionToken({ exp: now() - 30 })
      expect(await verify(token)).toBeNull()
      expect(await verify(token, { leewaySeconds: 60 })).not.toBeNull()
    })
  })

  describe('claims', () => {
    it('rejects a token issued for another app', async () => {
      expect(await verify(await signSessionToken({ aud: 'someone-elses-key' }))).toBeNull()
    })

    // `dest` names the shop the token speaks for and becomes the Admin API
    // origin, so a valid signature over an attacker-chosen `dest` — or an `iss`
    // that disagrees with it — must not resolve to a shop.
    it.each<[string, Partial<SessionTokenPayload>]>([
      ['a non-https dest', { dest: `http://${SHOP}`, iss: `http://${SHOP}/admin` }],
      [
        'a dest outside myshopify.com',
        { dest: 'https://attacker.example.com', iss: 'https://attacker.example.com/admin' },
      ],
      [
        'a host that merely contains myshopify.com',
        {
          dest: 'https://myshopify.com.attacker.example',
          iss: 'https://myshopify.com.attacker.example/admin',
        },
      ],
      ['iss and dest pointing at different shops', { iss: 'https://other.myshopify.com/admin' }],
      ['an unparseable dest', { dest: 'not a url' }],
    ])('rejects %s', async (_label, claims) => {
      expect(await verify(await signSessionToken(claims))).toBeNull()
    })
  })

  describe('malformed input', () => {
    it.each([
      ['empty', ''],
      ['two segments', 'aaa.bbb'],
      ['four segments', 'aaa.bbb.ccc.ddd'],
      ['non-base64 payload', 'aaa.!!!!.ccc'],
    ])('rejects %s', async (_label, token) => {
      expect(await verify(token)).toBeNull()
    })

    it('rejects a payload that is not JSON', async () => {
      const [header, , signature] = (await signSessionToken()).split('.')
      expect(await verify(`${header}.${btoa('plain text')}.${signature}`)).toBeNull()
    })

    // Every claim check passes, so this is the one path that reaches the
    // signature decode. It must return null rather than throw.
    it('rejects a non-base64 signature on an otherwise valid token', async () => {
      const [header, payload] = (await signSessionToken()).split('.')
      expect(await verify(`${header}.${payload}.!!!!`)).toBeNull()
    })
  })
})

describe('shopFromPayload', () => {
  it('extracts the shop domain', () => {
    expect(shopFromPayload(sessionPayload())).toBe(SHOP)
  })

  it('lowercases the host', () => {
    expect(shopFromPayload(sessionPayload({ dest: 'https://EXAMPLE.myshopify.com' }))).toBe(SHOP)
  })
})
