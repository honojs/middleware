import type { GenericSchema } from 'valibot'

import { collect } from '../errors/index'
import type { SchemaOf } from '../guard/index'
import { isSchemaType } from '../guard/index'
import { getInternalMetadata, getRefId } from '../metadata/index'
import { unwrapNullable } from '../pipe/index'
import type {
  MapNullableOfArray,
  MapSubSchema,
  ReferenceObject,
  SchemaObject,
  UnionPreferredType,
} from '../types/index'
import { isString } from '../utils/index'

// `undefined` has no JSON representation: a union member of `v.undefined()` only marks the
// value as omittable, which `required` already expresses.
// Recursive: without the annotation the return type resolves to `any`.
function flattenUnionOptions(schema: GenericSchema): readonly GenericSchema[] {
  if (isSchemaType(schema, 'union')) {
    return schema.options.flatMap(flattenUnionOptions)
  }
  return isSchemaType(schema, ['undefined', 'void']) ? [] : [schema]
}

/**
 * `v.union([...])` → `anyOf` (or `oneOf` when preferred). Nested unions are flattened and
 * nullable options are unwrapped, the whole union being marked nullable instead.
 */
export function unionSchema(
  schema: SchemaOf<'union'>,
  mapNullableOfArray: MapNullableOfArray,
  mapItem: MapSubSchema,
  preferredType: UnionPreferredType | undefined
) {
  const key = getInternalMetadata(schema).unionPreferredType ?? preferredType ?? 'anyOf'
  const options = collect(
    flattenUnionOptions(schema).map((option) => mapItem(unwrapNullable(option)))
  )
  if (!options.ok) {
    return options
  }
  const schemas = mapNullableOfArray([...options.value])
  // `anyOf` / `oneOf` must be non-empty arrays; a union of only `undefined` accepts anything
  if (schemas.length === 0) {
    return { ok: true, value: {} } as const
  }
  return { ok: true, value: { [key]: schemas } } as const
}

// Recursive: without the annotation the return type resolves to `any`.
function discriminatorValues(schema: GenericSchema, key: string): readonly string[] {
  if (isSchemaType(schema, ['object', 'loose_object', 'strict_object', 'object_with_rest'])) {
    const value = schema.entries[key]
    if (value === undefined) {
      return []
    }
    if (isSchemaType(value, ['picklist', 'enum'])) {
      return value.options.filter(isString)
    }
    if (isSchemaType(value, 'literal')) {
      return isString(value.literal) ? [value.literal] : []
    }
    return []
  }
  if (isSchemaType(schema, 'variant')) {
    return [...new Set(schema.options.flatMap((option) => discriminatorValues(option, key)))]
  }
  return []
}

function discriminatorMapping(
  options: readonly GenericSchema[],
  key: string,
  generateSchemaRef: (refId: string) => string
) {
  const refIds = options.map(getRefId)
  // All schemas must be registered to use a discriminator
  if (refIds.some((refId) => refId === undefined)) {
    return undefined
  }
  const mapping = Object.fromEntries(
    options.flatMap((option) => {
      const refId = getRefId(option)
      return refId === undefined
        ? []
        : discriminatorValues(option, key).map((value) => [value, generateSchemaRef(refId)])
    })
  )
  return { propertyName: key, mapping }
}

/**
 * `v.variant(key, [...])` → `oneOf` + `discriminator`. The discriminator mapping is only emitted
 * when every option is a registered component.
 */
export function variantSchema(
  schema: SchemaOf<'variant'>,
  isNullable: boolean,
  mapNullableOfArray: (
    objects: (SchemaObject | ReferenceObject)[],
    isNullable: boolean
  ) => (SchemaObject | ReferenceObject)[],
  mapItem: MapSubSchema,
  generateSchemaRef: (refId: string) => string
) {
  const options = collect(schema.options.map((option) => mapItem(option)))
  if (!options.ok) {
    return options
  }
  const optionSchemas = [...options.value]
  if (isNullable) {
    return { ok: true, value: { oneOf: mapNullableOfArray(optionSchemas, isNullable) } } as const
  }
  const discriminator = discriminatorMapping(schema.options, schema.key, generateSchemaRef)
  return {
    ok: true,
    value: {
      oneOf: optionSchemas,
      ...(discriminator === undefined ? {} : { discriminator }),
    },
  } as const
}

// Recursive: without the annotation the return type resolves to `any`.
function flattenIntersectOptions(schema: GenericSchema): readonly GenericSchema[] {
  return isSchemaType(schema, 'intersect')
    ? schema.options.flatMap(flattenIntersectOptions)
    : [schema]
}

/**
 * `v.intersect([...])` → `allOf`. Nested intersections are flattened.
 */
export function intersectSchema(
  schema: SchemaOf<'intersect'>,
  isNullable: boolean,
  mapNullableOfArray: (
    objects: (SchemaObject | ReferenceObject)[],
    isNullable: boolean
  ) => (SchemaObject | ReferenceObject)[],
  mapItem: MapSubSchema
) {
  const options = collect(flattenIntersectOptions(schema).map((option) => mapItem(option)))
  if (!options.ok) {
    return options
  }
  const allOfSchema: SchemaObject = { allOf: [...options.value] }
  return {
    ok: true,
    value: isNullable ? { anyOf: mapNullableOfArray([allOfSchema], isNullable) } : allOfSchema,
  } as const
}
