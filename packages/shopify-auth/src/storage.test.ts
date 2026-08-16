import { missingScopes } from './scopes'
import { memoryStorage } from './storage'
import { SHOP } from './test-utils'
import type { StoredShopifySession } from './types'

const session = (overrides: Partial<StoredShopifySession> = {}): StoredShopifySession => ({
  accessToken: 'shpua_token',
  scope: 'read_products',
  expiresAt: new Date('2030-01-01T00:00:00Z'),
  refreshToken: 'refresh',
  refreshTokenExpiresAt: new Date('2030-03-01T00:00:00Z'),
  ...overrides,
})

describe('memoryStorage', () => {
  it('returns null for an unknown shop', async () => {
    await expect(memoryStorage().load(SHOP)).resolves.toBeNull()
  })

  it('round-trips a session, preserving Date fields', async () => {
    const storage = memoryStorage()
    await storage.store(SHOP, session())

    const loaded = await storage.load(SHOP)
    expect(loaded).toEqual(session())
    expect(loaded?.expiresAt).toBeInstanceOf(Date)
    expect(loaded?.refreshTokenExpiresAt).toBeInstanceOf(Date)
  })

  it('preserves null expiry fields', async () => {
    const storage = memoryStorage()
    await storage.store(SHOP, session({ expiresAt: null, refreshTokenExpiresAt: null }))

    const loaded = await storage.load(SHOP)
    expect(loaded?.expiresAt).toBeNull()
    expect(loaded?.refreshTokenExpiresAt).toBeNull()
  })

  it('is last-write-wins per shop', async () => {
    const storage = memoryStorage()
    await storage.store(SHOP, session({ accessToken: 'first' }))
    await storage.store(SHOP, session({ accessToken: 'second' }))

    await expect(storage.load(SHOP)).resolves.toMatchObject({ accessToken: 'second' })
  })

  it('keeps shops isolated', async () => {
    const storage = memoryStorage()
    await storage.store(SHOP, session({ accessToken: 'ours' }))
    await storage.store('other.myshopify.com', session({ accessToken: 'theirs' }))

    await expect(storage.load(SHOP)).resolves.toMatchObject({ accessToken: 'ours' })
  })

  it('deletes', async () => {
    const storage = memoryStorage()
    await storage.store(SHOP, session())
    await storage.delete(SHOP)

    await expect(storage.load(SHOP)).resolves.toBeNull()
  })

  it('is unaffected by later mutation of the stored object', async () => {
    const storage = memoryStorage()
    const original = session()
    await storage.store(SHOP, original)
    original.accessToken = 'mutated'

    await expect(storage.load(SHOP)).resolves.toMatchObject({ accessToken: 'shpua_token' })
  })
})

describe('missingScopes', () => {
  it('reports scopes that were not granted', () => {
    expect(
      missingScopes('read_products,write_orders', ['read_products', 'read_customers'])
    ).toEqual(['read_customers'])
  })

  it('returns an empty array when everything is granted', () => {
    expect(missingScopes('read_products,write_orders', ['read_products'])).toEqual([])
  })

  it('tolerates whitespace between scopes', () => {
    expect(missingScopes('read_products, write_orders', ['write_orders'])).toEqual([])
  })

  it('treats an empty grant as holding nothing', () => {
    expect(missingScopes('', ['read_products'])).toEqual(['read_products'])
  })

  it('requires an exact match', () => {
    expect(missingScopes('read_products', ['read_product'])).toEqual(['read_product'])
  })

  it('treats a write scope as granting its read counterpart', () => {
    expect(missingScopes('write_products', ['read_products', 'write_products'])).toEqual([])
  })

  it('treats an unauthenticated write scope as granting its read counterpart', () => {
    expect(
      missingScopes('unauthenticated_write_checkouts', ['unauthenticated_read_checkouts'])
    ).toEqual([])
  })

  it('does not treat a read scope as granting write', () => {
    expect(missingScopes('read_products', ['write_products'])).toEqual(['write_products'])
  })

  it('only implies the read scope for the same resource', () => {
    expect(missingScopes('write_products', ['read_orders'])).toEqual(['read_orders'])
  })
})
