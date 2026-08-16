export {
  getShopifyAccess,
  getShopifySession,
  getShopifyWebhook,
  shopifyAccessToken,
  shopifySessionToken,
  shopifyWebhook,
} from './middleware'

export { shopFromPayload, verifyShopifySessionToken } from './session-token'
export type { VerifySessionTokenOptions } from './session-token'

export { verifyShopifyHmac } from './hmac'
export { missingScopes } from './scopes'
export { normalizeShopDomain } from './shop-domain'
export { memoryStorage } from './storage'

export {
  adminGraphql,
  DEFAULT_API_VERSION,
  ShopifyAccessDeniedError,
  ShopifyGraphqlError,
} from './admin-graphql'
export type { AdminGraphqlOptions } from './admin-graphql'

export type {
  ReExchangeToken,
  SessionTokenPayload,
  ShopifyAccessSession,
  ShopifyAccessTokenOptions,
  ShopifyAuthErrorHandler,
  ShopifyAuthVariables,
  ShopifySessionStorage,
  ShopifySessionTokenOptions,
  ShopifyVerifiedSession,
  ShopifyWebhookContext,
  ShopifyWebhookOptions,
  StoredShopifySession,
  ValueOrResolver,
} from './types'

import type { ShopifyAuthVariables } from './types'

declare module 'hono' {
  interface ContextVariableMap extends ShopifyAuthVariables {}
}
