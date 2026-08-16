import { shopFromPayload, verifyShopifySessionToken } from './session-token'
import { API_KEY, API_SECRET, SHOP, sessionPayload, signSessionToken } from './test-utils'

const verify = (token: string, options?: { leewaySeconds?: number }) =>
  verifyShopifySessionToken(token, API_KEY, API_SECRET, options)

describe('verifyShopifySessionToken', () => {
  it('accepts a well-formed token', async () => {
    const payload = await verify(await signSessionToken())
    expect(payload).not.toBeNull()
    expect(payload?.aud).toBe(API_KEY)
    expect(payload?.dest).toBe(`https://${SHOP}`)
  })

  describe('signature', () => {
    it('rejects a token signed with a different secret', async () => {
      const token = await signSessionToken({}, { secret: 'not-our-secret' })
      expect(await verify(token)).toBeNull()
    })

    it('rejects a tampered payload', async () => {
      const [header, , signature] = (await signSessionToken()).split('.')
      const forged = btoa(JSON.stringify(sessionPayload({ dest: 'https://evil.myshopify.com' })))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')
      expect(await verify(`${header}.${forged}.${signature}`)).toBeNull()
    })
  })

  describe('algorithm', () => {
    it('rejects alg: none', async () => {
      const token = await signSessionToken({}, { header: { alg: 'none', typ: 'JWT' } })
      expect(await verify(token)).toBeNull()
    })

    it('rejects an asymmetric alg', async () => {
      const token = await signSessionToken({}, { header: { alg: 'RS256', typ: 'JWT' } })
      expect(await verify(token)).toBeNull()
    })

    it('rejects a header with no alg', async () => {
      const token = await signSessionToken({}, { header: { typ: 'JWT' } })
      expect(await verify(token)).toBeNull()
    })
  })

  describe('lifetime', () => {
    const now = () => Math.floor(Date.now() / 1000)

    it('rejects an expired token', async () => {
      expect(await verify(await signSessionToken({ exp: now() - 120 }))).toBeNull()
    })

    it('accepts a token that expired within the leeway', async () => {
      expect(await verify(await signSessionToken({ exp: now() - 5 }))).not.toBeNull()
    })

    it('honours a custom leeway', async () => {
      const token = await signSessionToken({ exp: now() - 30 })
      expect(await verify(token)).toBeNull()
      expect(await verify(token, { leewaySeconds: 60 })).not.toBeNull()
    })

    it('rejects a token that is not yet valid', async () => {
      expect(await verify(await signSessionToken({ nbf: now() + 120 }))).toBeNull()
    })

    it('accepts an nbf within the leeway', async () => {
      expect(await verify(await signSessionToken({ nbf: now() + 5 }))).not.toBeNull()
    })
  })

  describe('claims', () => {
    it('rejects a token issued for another app', async () => {
      expect(await verify(await signSessionToken({ aud: 'someone-elses-key' }))).toBeNull()
    })

    it('rejects a non-https dest', async () => {
      const token = await signSessionToken({
        dest: `http://${SHOP}`,
        iss: `http://${SHOP}/admin`,
      })
      expect(await verify(token)).toBeNull()
    })

    it('rejects a dest outside myshopify.com', async () => {
      const token = await signSessionToken({
        dest: 'https://attacker.example.com',
        iss: 'https://attacker.example.com/admin',
      })
      expect(await verify(token)).toBeNull()
    })

    it('rejects a host that merely contains myshopify.com', async () => {
      const token = await signSessionToken({
        dest: 'https://myshopify.com.attacker.example',
        iss: 'https://myshopify.com.attacker.example/admin',
      })
      expect(await verify(token)).toBeNull()
    })

    it('rejects iss and dest pointing at different shops', async () => {
      const token = await signSessionToken({ iss: 'https://other.myshopify.com/admin' })
      expect(await verify(token)).toBeNull()
    })

    it('rejects an unparseable dest', async () => {
      expect(await verify(await signSessionToken({ dest: 'not a url' }))).toBeNull()
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
