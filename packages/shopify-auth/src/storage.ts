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
      return Promise.resolve(sessions.get(shop) ?? null)
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
