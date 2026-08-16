import { verifyShopifyHmac } from './hmac'
import { API_SECRET, signWebhook } from './test-utils'

const bytes = (body: string) => new TextEncoder().encode(body).buffer as ArrayBuffer

describe('verifyShopifyHmac', () => {
  const body = JSON.stringify({ id: 1, name: '#1001' })

  it('accepts a correct signature', async () => {
    expect(await verifyShopifyHmac(bytes(body), await signWebhook(body), API_SECRET)).toBe(true)
  })

  it('rejects a signature over different bytes', async () => {
    const signature = await signWebhook(body)
    const tampered = JSON.stringify({ id: 2, name: '#1001' })
    expect(await verifyShopifyHmac(bytes(tampered), signature, API_SECRET)).toBe(false)
  })

  it('rejects a signature made with another secret', async () => {
    const signature = await signWebhook(body, 'not-our-secret')
    expect(await verifyShopifyHmac(bytes(body), signature, API_SECRET)).toBe(false)
  })

  it('rejects a missing header', async () => {
    expect(await verifyShopifyHmac(bytes(body), null, API_SECRET)).toBe(false)
  })

  it('rejects an empty secret', async () => {
    expect(await verifyShopifyHmac(bytes(body), await signWebhook(body), '')).toBe(false)
  })

  it('rejects a header that is not valid base64', async () => {
    expect(await verifyShopifyHmac(bytes(body), '!!!not base64!!!', API_SECRET)).toBe(false)
  })

  it('verifies an empty body', async () => {
    expect(await verifyShopifyHmac(bytes(''), await signWebhook(''), API_SECRET)).toBe(true)
  })
})
