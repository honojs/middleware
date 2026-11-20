/**
 * Type guard for `undefined`.
 */
export function isUndefined(value: unknown): value is undefined {
  return value === undefined
}

/**
 * Type guard for `string`.
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string'
}

/**
 * Type guard for a non-null object (arrays included).
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Drops the entries whose value satisfies `predicate`.
 *
 * @example
 * omitBy({ a: 1, b: undefined }, isUndefined) // { a: 1 }
 */
export function omitBy<T extends object>(
  object: T,
  predicate: (value: unknown, key: string) => boolean
) {
  return Object.keys(object).reduce<Partial<T>>((acc, key) => {
    const value = Reflect.get(object, key)
    return predicate(value, key) ? acc : Object.assign(acc, { [key]: value })
  }, {})
}

/**
 * Removes `undefined` entries from an array.
 */
export function compact<T>(values: readonly (T | undefined)[]) {
  return values.filter((value): value is T => value !== undefined)
}

/**
 * Structural deep equality used to compare generated OpenAPI objects.
 *
 * @example
 * isEqual({ a: [1] }, { a: [1] }) // true
 */
// Recursive: without the annotation the return type resolves to `any`.
export function isEqual(x: unknown, y: unknown): boolean {
  if (x === y) {
    return true
  }
  if (Array.isArray(x) || Array.isArray(y)) {
    return (
      Array.isArray(x) &&
      Array.isArray(y) &&
      x.length === y.length &&
      x.every((item, index) => isEqual(item, y[index]))
    )
  }
  if (!isObject(x) || !isObject(y)) {
    return false
  }
  const keysX = Object.keys(x)
  const keysY = Object.keys(y)
  return (
    keysX.length === keysY.length &&
    keysY.every((key) => keysX.includes(key)) &&
    keysX.every((key) => isEqual(x[key], y[key]))
  )
}

/**
 * Removes structurally equal duplicates, keeping the first occurrence.
 *
 * @example
 * uniq([{ type: 'string' }, { type: 'string' }]) // [{ type: 'string' }]
 */
export function uniq<T>(values: readonly T[]) {
  return values.filter(
    (value, index) => !values.slice(0, index).some((seen) => isEqual(seen, value))
  )
}

/**
 * Returns a new record with the keys sorted with `localeCompare`.
 */
export function sortObjectByKeys<T>(object: { readonly [key: string]: T }) {
  return Object.fromEntries(
    [...Object.entries(object)].sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
  )
}

/**
 * Classifies enum values as string-only, numeric-only or mixed.
 *
 * @example
 * enumInfo(['a', 'b']) // { values: ['a', 'b'], type: 'string' }
 * enumInfo([1, 2]) // { values: [1, 2], type: 'numeric' }
 */
export function enumInfo(values: readonly unknown[]) {
  const numericCount = values.filter((value) => typeof value === 'number').length
  const type =
    numericCount === 0
      ? ('string' as const)
      : numericCount === values.length
        ? ('numeric' as const)
        : ('mixed' as const)
  return { values: [...values], type }
}

/**
 * JSON pointer to a component schema.
 *
 * @example
 * schemaRef('User') // '#/components/schemas/User'
 */
// `schemaRef` and `parameterRef` spell their template literal type out: inference widens a
// template literal expression to `string`, which no longer fits the `$ref` model type.
// `componentRef` feeds no such field, so it stays inferred.
export function schemaRef(refId: string): `#/components/schemas/${string}` {
  return `#/components/schemas/${refId}`
}

/**
 * JSON pointer to a component parameter.
 *
 * @example
 * parameterRef('Id') // '#/components/parameters/Id'
 */
export function parameterRef(refId: string): `#/components/parameters/${string}` {
  return `#/components/parameters/${refId}`
}

/**
 * JSON pointer to an arbitrary component.
 *
 * @example
 * componentRef('securitySchemes', 'bearer') // '#/components/securitySchemes/bearer'
 */
export function componentRef(type: string, name: string) {
  return `#/components/${type}/${name}`
}

/**
 * Returns `true` when the OpenAPI object is a `$ref` reference.
 */
export function isReferenceObject<T extends object>(
  value: T
): value is Extract<T, { readonly $ref: unknown }> {
  return '$ref' in value && typeof value.$ref === 'string'
}
