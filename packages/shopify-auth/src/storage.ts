import type { ShopifySessionStorage, StoredShopifySession } from './types'

/**
 * In-memory session storage, for tests and local development.
 *
 * Not suitable for production: it does not survive a restart, and on
 * serverless platforms it does not reliably survive between requests.
 */
export function memoryStorage(): ShopifySessionStorage {
  const sessions = new Map<string, StoredShopifySession>()

  return {
    load(shop: string): Promise<StoredShopifySession | null> {
      // Copied on the way out too, so mutating a loaded session cannot reach
      // back into the store. Adapters backed by KV or SQL deserialize a fresh
      // object every time; without this, code that mutates what it loaded would
      // behave one way in tests and another in production.
      const found = sessions.get(shop)
      return Promise.resolve(found === undefined ? null : { ...found })
    },
    store(shop: string, session: StoredShopifySession): Promise<void> {
      // Copied so a later mutation by the caller cannot alter what is stored.
      sessions.set(shop, { ...session })
      return Promise.resolve()
    },
    delete(shop: string): Promise<void> {
      sessions.delete(shop)
      return Promise.resolve()
    },
  }
}
