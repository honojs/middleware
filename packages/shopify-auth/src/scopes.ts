/**
 * Returns the entries of `required` that are absent from a granted scope
 * string (the comma-separated form Shopify returns alongside an access token).
 *
 * @example
 * ```ts
 * missingScopes('read_products,write_orders', ['read_products', 'read_customers'])
 * // → ['read_customers']
 * ```
 */
export function missingScopes(granted: string, required: readonly string[]): string[] {
  const held = new Set(
    granted
      .split(',')
      .map((scope) => scope.trim())
      .filter(Boolean)
  )
  return required.filter((scope) => !held.has(scope))
}
