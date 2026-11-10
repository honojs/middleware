import type {
  NumberBounds,
  NumberCheck,
  ReferenceObject,
  SchemaObjectType,
  VersionSpecifics,
} from '../types/index'
import { isEqual, uniq } from '../utils/index'

const NULL_TYPE_30 = { nullable: true } as const
const NULL_TYPE_31 = { type: 'null' } as const

const BOUNDS_V30: { readonly [K in NumberCheck['kind']]: (value: number) => NumberBounds } = {
  min_value: (value) => ({ minimum: value }),
  gt_value: (value) => ({ minimum: value, exclusiveMinimum: true }),
  max_value: (value) => ({ maximum: value }),
  lt_value: (value) => ({ maximum: value, exclusiveMaximum: true }),
}

/**
 * OpenAPI 3.0.x: `nullable: true`, boolean `exclusiveMinimum` / `exclusiveMaximum`, tuples as
 * `items` + `minItems` / `maxItems`.
 */
export const specificsV30: VersionSpecifics = {
  nullType: NULL_TYPE_30,
  mapNullableOfArray: (objects, isNullable) =>
    isNullable && !objects.some((object) => isEqual(object, NULL_TYPE_30))
      ? [...objects, NULL_TYPE_30]
      : objects,
  mapNullableType: (type, isNullable) => ({
    ...(type ? { type } : {}),
    ...(isNullable ? NULL_TYPE_30 : {}),
  }),
  mapNullableOfRef: (ref, isNullable) => (isNullable ? { allOf: [ref, NULL_TYPE_30] } : ref),
  mapTupleItems: (schemas, rest) => {
    const uniqueSchemas = uniq(rest === undefined ? schemas : [...schemas, rest])
    return {
      items: uniqueSchemas.length === 1 ? uniqueSchemas[0] : { anyOf: uniqueSchemas },
      minItems: schemas.length,
      ...(rest === undefined ? { maxItems: schemas.length } : {}),
    }
  },
  getNumberChecks: (checks) =>
    Object.fromEntries(
      checks.flatMap((check) => Object.entries(BOUNDS_V30[check.kind](check.value)))
    ),
}

const BOUNDS_V31: { readonly [K in NumberCheck['kind']]: (value: number) => NumberBounds } = {
  min_value: (value) => ({ minimum: value }),
  gt_value: (value) => ({ exclusiveMinimum: value }),
  max_value: (value) => ({ maximum: value }),
  lt_value: (value) => ({ exclusiveMaximum: value }),
}

/**
 * OpenAPI 3.1.x / 3.2.x (JSON Schema 2020-12): `type: ['x', 'null']`, numeric
 * `exclusiveMinimum` / `exclusiveMaximum`, tuples as `prefixItems`.
 */
export const specificsV31: VersionSpecifics = {
  nullType: NULL_TYPE_31,
  mapNullableOfArray: (objects, isNullable) =>
    isNullable && !objects.some((object) => isEqual(object, NULL_TYPE_31))
      ? [...objects, NULL_TYPE_31]
      : objects,
  mapNullableType: (type, isNullable) => {
    if (!type) {
      // `null` is a type in OpenAPI 3.1 => not providing a type already includes null.
      return {}
    }
    if (isNullable) {
      const typeArray: readonly SchemaObjectType[] = Array.isArray(type) ? type : [type]
      return { type: uniq<SchemaObjectType>([...typeArray, 'null']) }
    }
    return { type }
  },
  mapNullableOfRef: (ref: ReferenceObject, isNullable) =>
    isNullable ? { oneOf: [ref, NULL_TYPE_31] } : ref,
  mapTupleItems: (schemas, rest) => ({
    prefixItems: schemas,
    ...(rest === undefined ? {} : { items: rest }),
  }),
  getNumberChecks: (checks) =>
    Object.fromEntries(
      checks.flatMap((check) => Object.entries(BOUNDS_V31[check.kind](check.value)))
    ),
}

/**
 * Picks the version specifics for an OpenAPI version string.
 *
 * @example
 * specificsFor('3.0.3') // specificsV30
 * specificsFor('3.1.0') // specificsV31
 */
export function specificsFor(version: string) {
  return version.startsWith('3.0') ? specificsV30 : specificsV31
}
