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

  // `toEqual` compares Dates by value, so a round-trip that stringified them
  // would fail here rather than surface as a bad expiry comparison later.
  it.each([
    ['a session with expiry dates', {}],
    ['a session with null expiry fields', { expiresAt: null, refreshTokenExpiresAt: null }],
  ])('round-trips %s', async (_label, overrides) => {
    const storage = memoryStorage()
    await storage.store(SHOP, session(overrides))

    await expect(storage.load(SHOP)).resolves.toEqual(session(overrides))
  })

  it('is last-write-wins per shop, and keeps shops isolated', async () => {
    const storage = memoryStorage()
    await storage.store(SHOP, session({ accessToken: 'first' }))
    await storage.store(SHOP, session({ accessToken: 'second' }))
    await storage.store('other.myshopify.com', session({ accessToken: 'theirs' }))

    await expect(storage.load(SHOP)).resolves.toMatchObject({ accessToken: 'second' })
    await expect(storage.load('other.myshopify.com')).resolves.toMatchObject({
      accessToken: 'theirs',
    })
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

  // The read path has to be as isolating as the write path: a KV- or SQL-backed
  // adapter deserializes a fresh object every time, so a handler that mutates
  // what it loaded must not behave differently here than it does in production.
  it('is unaffected by mutation of a loaded session', async () => {
    const storage = memoryStorage()
    await storage.store(SHOP, session())

    const loaded = await storage.load(SHOP)
    if (loaded === null) {
      throw new Error('expected a stored session')
    }
    loaded.accessToken = 'mutated'

    await expect(storage.load(SHOP)).resolves.toMatchObject({ accessToken: 'shpua_token' })
  })
})

describe('missingScopes', () => {
  it.each<[string, string, string[], string[]]>([
    [
      'reports scopes that were not granted',
      'read_products,write_orders',
      ['read_products', 'read_customers'],
      ['read_customers'],
    ],
    [
      'returns an empty array when everything is granted',
      'read_products,write_orders',
      ['read_products'],
      [],
    ],
    ['tolerates whitespace between scopes', 'read_products, write_orders', ['write_orders'], []],
    ['treats an empty grant as holding nothing', '', ['read_products'], ['read_products']],
    ['requires an exact match', 'read_products', ['read_product'], ['read_product']],
    [
      'treats a write scope as granting its read counterpart',
      'write_products',
      ['read_products', 'write_products'],
      [],
    ],
    [
      'treats an unauthenticated write scope as granting its read counterpart',
      'unauthenticated_write_checkouts',
      ['unauthenticated_read_checkouts'],
      [],
    ],
    [
      'does not treat a read scope as granting write',
      'read_products',
      ['write_products'],
      ['write_products'],
    ],
    [
      'only implies the read scope for the same resource',
      'write_products',
      ['read_orders'],
      ['read_orders'],
    ],
  ])('%s', (_label, granted, required, expected) => {
    expect(missingScopes(granted, required)).toEqual(expected)
  })
})
