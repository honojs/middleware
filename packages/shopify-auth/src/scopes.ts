const WRITE_SCOPE = /^(unauthenticated_)?write_/

/**
 * Returns the entries of `required` that are absent from a granted scope
 * string (the comma-separated form Shopify returns alongside an access token).
 *
 * A `write_*` grant implies its `read_*` counterpart: Shopify grants read
 * access along with write access but reports only the write scope, so
 * `write_products` satisfies a `read_products` requirement.
 *
 * @example
 * ```ts
 * missingScopes('read_products,write_orders', ['read_products', 'read_customers'])
 * // → ['read_customers']
 *
 * missingScopes('write_products', ['read_products'])
 * // → []
 * ```
 */
export function missingScopes(granted: string, required: readonly string[]): string[] {
  const held = new Set<string>()
  for (const entry of granted.split(',')) {
    const scope = entry.trim()
    if (!scope) {
      continue
    }
    held.add(scope)
    if (WRITE_SCOPE.test(scope)) {
      held.add(scope.replace('write_', 'read_'))
    }
  }
  return required.filter((scope) => !held.has(scope))
}
