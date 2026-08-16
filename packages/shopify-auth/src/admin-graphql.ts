import type { ReExchangeToken } from './types'

/** Admin API version used when none is supplied. */
export const DEFAULT_API_VERSION = '2026-07'

/** A non-2xx response, or a GraphQL response carrying top-level `errors`. */
export class ShopifyGraphqlError extends Error {
  readonly status: number
  readonly errors: unknown

  constructor(message: string, status: number, errors: unknown) {
    super(message)
    this.name = 'ShopifyGraphqlError'
    this.status = status
    this.errors = errors
  }
}

/**
 * The request was rejected for lack of authorization — an invalid or revoked
 * token, or a missing access scope. Distinguished from `ShopifyGraphqlError` so
 * a scope problem can be handled separately from a transient failure.
 */
export class ShopifyAccessDeniedError extends ShopifyGraphqlError {
  constructor(message: string, status: number, errors: unknown) {
    super(message, status, errors)
    this.name = 'ShopifyAccessDeniedError'
  }
}

export interface AdminGraphqlOptions {
  shop: string
  accessToken: string
  query: string
  variables?: Record<string, unknown>
  /**
   * Supplied by `shopifyAccessToken`. When Shopify answers 401 — a token
   * revoked out of band, typically an uninstall followed by a reinstall — a
   * fresh token is minted and the request retried exactly once.
   */
  reExchange?: ReExchangeToken
  /** Defaults to {@link DEFAULT_API_VERSION}. */
  apiVersion?: string
}

interface GraphqlResponse<T> {
  data?: T
  errors?: unknown
}

function hasAccessDeniedCode(errors: unknown): boolean {
  if (!Array.isArray(errors)) {
    return false
  }
  return errors.some(
    (error) => (error as { extensions?: { code?: string } })?.extensions?.code === 'ACCESS_DENIED'
  )
}

/**
 * Sends a GraphQL operation to the Shopify Admin API.
 *
 * Throws {@link ShopifyGraphqlError} on a non-2xx response or when the body
 * carries top-level `errors`. `userErrors` nested inside `data` are *not*
 * treated as fatal — inspect those yourself.
 */
export async function adminGraphql<T = unknown>(options: AdminGraphqlOptions): Promise<T> {
  const { shop, query, variables, reExchange, apiVersion = DEFAULT_API_VERSION } = options
  const url = `https://${shop}/admin/api/${apiVersion}/graphql.json`

  let accessToken = options.accessToken
  let retried = false

  for (;;) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: JSON.stringify({ query, variables: variables ?? {} }),
    })

    if (!res.ok) {
      if (res.status === 401 && reExchange && !retried) {
        retried = true
        const fresh = await reExchange()
        if (fresh !== null) {
          accessToken = fresh
          continue
        }
      }
      const text = await res.text().catch(() => '')
      const message = `Shopify Admin GraphQL HTTP ${res.status}: ${text.slice(0, 500)}`
      if (res.status === 401 || res.status === 403) {
        throw new ShopifyAccessDeniedError(message, res.status, null)
      }
      throw new ShopifyGraphqlError(message, res.status, null)
    }

    const json = (await res.json()) as GraphqlResponse<T>
    if (json.errors) {
      const message = `Shopify Admin GraphQL errors: ${JSON.stringify(json.errors)}`
      if (hasAccessDeniedCode(json.errors)) {
        throw new ShopifyAccessDeniedError(message, res.status, json.errors)
      }
      throw new ShopifyGraphqlError(message, res.status, json.errors)
    }

    return json.data as T
  }
}
