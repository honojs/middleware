/**
 * A shop domain is a single label under `myshopify.com`, and it is interpolated
 * straight into an Admin API origin (`https://${shop}/admin/api/…`). The whole
 * string is matched, not just its suffix, because a suffix test accepts values
 * like `evil.example.com#.myshopify.com` — the fragment makes it end in
 * `.myshopify.com` while the URL still resolves to `evil.example.com`.
 */
const SHOP_DOMAIN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/

/**
 * Normalizes a shop domain to its canonical lowercase form, or returns `null`
 * when the value is not a bare `*.myshopify.com` host.
 *
 * Worth running on any shop domain that did not arrive inside a signed payload —
 * a webhook header, an OAuth `shop` query parameter — since those values end up
 * in a URL that carries an access token.
 *
 * @example
 * ```ts
 * normalizeShopDomain('Example.MyShopify.Com')          // → 'example.myshopify.com'
 * normalizeShopDomain('evil.example.com#.myshopify.com') // → null
 * ```
 */
export function normalizeShopDomain(value: string | null | undefined): string | null {
  const normalized = value?.toLowerCase()
  return normalized !== undefined && SHOP_DOMAIN.test(normalized) ? normalized : null
}

/**
 * The shop named inside a webhook payload, lowercased, or `null` when the topic
 * does not carry one.
 *
 * The GDPR topics (`customers/data_request`, `customers/redact`, `shop/redact`)
 * send `shop_domain`; `shop/*` sends `myshopify_domain`. Everything else — the
 * `orders/*` and `products/*` bulk of deliveries — identifies its shop only in
 * the unsigned header.
 */
export function shopFromWebhookPayload(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) {
    return null
  }
  const record = payload as Record<string, unknown>
  const named = record['shop_domain'] ?? record['myshopify_domain']
  return typeof named === 'string' ? named.toLowerCase() : null
}
