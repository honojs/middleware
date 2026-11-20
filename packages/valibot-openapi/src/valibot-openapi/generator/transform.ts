import type { GenericSchema } from 'valibot'

import { unknownSchemaTypeError } from '../errors/index'
import { isSchemaType, OBJECT_TYPES, TUPLE_TYPES } from '../guard/index'
import { getRefId } from '../metadata/index'
import type {
  GeneratorOptions,
  MapSubSchema,
  ReferenceObject,
  SchemaObject,
  VersionSpecifics,
} from '../types/index'
import { arraySchema, setSchema, tupleSchema } from './array'
import { lazySchema } from './lazy'
import { enumSchema, literalSchema } from './literal'
import { bigintSchema, dateSchema, numberSchema } from './number'
import { objectSchema, recordSchema } from './object'
import { stringSchema } from './string'
import { intersectSchema, unionSchema, variantSchema } from './union'

export type TransformContext = {
  readonly specifics: VersionSpecifics
  readonly options: GeneratorOptions | undefined
  readonly mapItem: MapSubSchema
  readonly generateSchemaRef: (refId: string) => string
}

/**
 * Converts an unwrapped valibot schema to an OpenAPI SchemaObject. Nullability and the default
 * value are computed by the caller from the wrapped schema; `mapItem` registers sub-schemas.
 */
export function transformSchema(
  schema: GenericSchema,
  isNullable: boolean,
  defaultValue: unknown,
  ctx: TransformContext
) {
  const { specifics, mapItem } = ctx
  if (isSchemaType(schema, 'null')) {
    return { ok: true, value: specifics.nullType } as const
  }
  if (isSchemaType(schema, ['unknown', 'any'])) {
    return { ok: true, value: specifics.mapNullableType(undefined, isNullable) } as const
  }
  if (isSchemaType(schema, OBJECT_TYPES)) {
    return objectSchema(
      schema,
      defaultValue,
      (type) => specifics.mapNullableType(type, isNullable),
      mapItem
    )
  }
  const result = transformWithoutDefault(schema, isNullable, ctx)
  if (!result.ok) {
    return result
  }
  return { ok: true, value: { ...result.value, default: defaultValue } } as const
}

function transformWithoutDefault(
  schema: GenericSchema,
  isNullable: boolean,
  ctx: TransformContext
) {
  const { specifics, options, mapItem, generateSchemaRef } = ctx
  const mapNullableType = (type: Parameters<VersionSpecifics['mapNullableType']>[0]) =>
    specifics.mapNullableType(type, isNullable)
  const mapNullableOfArray = (objects: (SchemaObject | ReferenceObject)[]) =>
    specifics.mapNullableOfArray(objects, isNullable)

  if (isSchemaType(schema, 'string')) {
    return { ok: true, value: stringSchema(schema, mapNullableType) } as const
  }
  if (isSchemaType(schema, 'number')) {
    return {
      ok: true,
      value: numberSchema(schema, mapNullableType, specifics.getNumberChecks),
    } as const
  }
  if (isSchemaType(schema, 'bigint')) {
    return { ok: true, value: bigintSchema(mapNullableType) } as const
  }
  if (isSchemaType(schema, 'boolean')) {
    return { ok: true, value: mapNullableType('boolean') } as const
  }
  if (isSchemaType(schema, 'date')) {
    return { ok: true, value: dateSchema(mapNullableType) } as const
  }
  if (isSchemaType(schema, 'lazy')) {
    return lazySchema(schema, mapItem, mapNullableType, (ref) =>
      specifics.mapNullableOfRef(ref, isNullable)
    )
  }
  if (isSchemaType(schema, 'literal')) {
    return { ok: true, value: literalSchema(schema, mapNullableType) } as const
  }
  if (isSchemaType(schema, ['picklist', 'enum'])) {
    return enumSchema(schema, isNullable, mapNullableType)
  }
  if (isSchemaType(schema, 'array')) {
    return arraySchema(schema, mapNullableType, mapItem)
  }
  if (isSchemaType(schema, 'set')) {
    return setSchema(schema, mapNullableType, mapItem)
  }
  if (isSchemaType(schema, TUPLE_TYPES)) {
    return tupleSchema(schema, mapNullableType, mapItem, specifics.mapTupleItems)
  }
  if (isSchemaType(schema, 'variant')) {
    return variantSchema(
      schema,
      isNullable,
      specifics.mapNullableOfArray,
      mapItem,
      generateSchemaRef
    )
  }
  if (isSchemaType(schema, 'union')) {
    return unionSchema(schema, mapNullableOfArray, mapItem, options?.unionPreferredType)
  }
  if (isSchemaType(schema, 'intersect')) {
    return intersectSchema(schema, isNullable, specifics.mapNullableOfArray, mapItem)
  }
  if (isSchemaType(schema, 'record')) {
    return recordSchema(schema, mapNullableType, mapItem)
  }
  return {
    ok: false,
    error: unknownSchemaTypeError({ currentSchema: schema, schemaName: getRefId(schema) }),
  } as const
}
