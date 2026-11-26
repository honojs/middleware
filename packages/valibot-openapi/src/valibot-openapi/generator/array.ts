import { collect } from '../errors/index'
import type { SchemaOf } from '../guard/index'
import { findValidation, inputValidations, requirementNumber } from '../pipe/index'
import type { MapNullableType, MapSubSchema, VersionSpecifics } from '../types/index'

/**
 * `v.array(item)` with length validations.
 */
export function arraySchema(
  schema: SchemaOf<'array'>,
  mapNullableType: MapNullableType,
  mapItem: MapSubSchema
) {
  const validations = inputValidations(schema)
  const length = requirementNumber(validations, 'length')
  const nonEmpty = findValidation(validations, 'non_empty') === undefined ? undefined : 1
  const items = mapItem(schema.item)
  if (!items.ok) {
    return items
  }
  return {
    ok: true,
    value: {
      ...mapNullableType('array'),
      items: items.value,
      minItems: length ?? requirementNumber(validations, 'min_length') ?? nonEmpty,
      maxItems: length ?? requirementNumber(validations, 'max_length'),
    },
  } as const
}

/**
 * `v.set(value)` → array with `uniqueItems`.
 */
export function setSchema(
  schema: SchemaOf<'set'>,
  mapNullableType: MapNullableType,
  mapItem: MapSubSchema
) {
  const validations = inputValidations(schema)
  const items = mapItem(schema.value)
  if (!items.ok) {
    return items
  }
  return {
    ok: true,
    value: {
      ...mapNullableType('array'),
      items: items.value,
      uniqueItems: true,
      minItems: requirementNumber(validations, 'min_size'),
      maxItems: requirementNumber(validations, 'max_size'),
    },
  } as const
}

/**
 * `v.tuple([...])` / `v.tupleWithRest([...], rest)` — the per-version layout (`items` +
 * `minItems` / `maxItems` for 3.0, `prefixItems` for 3.1+) comes from the specifics.
 */
export function tupleSchema(
  schema:
    | SchemaOf<'tuple'>
    | SchemaOf<'strict_tuple'>
    | SchemaOf<'loose_tuple'>
    | SchemaOf<'tuple_with_rest'>,
  mapNullableType: MapNullableType,
  mapItem: MapSubSchema,
  mapTupleItems: VersionSpecifics['mapTupleItems']
) {
  const rest = 'rest' in schema ? mapItem(schema.rest) : undefined
  if (rest !== undefined && !rest.ok) {
    return rest
  }
  const items = collect(schema.items.map((item) => mapItem(item)))
  if (!items.ok) {
    return items
  }
  return {
    ok: true,
    value: {
      ...mapNullableType('array'),
      ...mapTupleItems([...items.value], rest?.value),
    },
  } as const
}
