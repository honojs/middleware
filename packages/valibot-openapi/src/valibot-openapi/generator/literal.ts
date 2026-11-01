import { valibotToOpenAPIError } from '../errors/index'
import type { SchemaOf } from '../guard/index'
import type { MapNullableType } from '../types/index'
import { enumInfo } from '../utils/index'
import { bigintSchema } from './number'

/**
 * `v.literal(value)` → single-value `enum`.
 *
 * @example
 * literalSchema(v.literal('a'), mapNullableType) // { type: 'string', enum: ['a'] }
 */
export function literalSchema(schema: SchemaOf<'literal'>, mapNullableType: MapNullableType) {
  const value = schema.literal
  const type = typeof value
  if (type === 'boolean' || type === 'number' || type === 'string') {
    return { ...mapNullableType(type), enum: [value] }
  }
  if (type === 'bigint') {
    return bigintSchema(mapNullableType)
  }
  return mapNullableType('null')
}

/**
 * `v.picklist([...])` / `v.enum(Enum)` → `enum`. Mixed string / number values cannot be
 * described by a single JSON Schema `type`, so they must be typed manually via `openapi()`.
 *
 * @example
 * enumSchema(v.picklist(['a', 'b']), false, mapNullableType)
 * // { ok: true, value: { type: 'string', enum: ['a', 'b'] } }
 */
export function enumSchema(
  schema: SchemaOf<'picklist'> | SchemaOf<'enum'>,
  isNullable: boolean,
  mapNullableType: MapNullableType
) {
  const { type, values } = enumInfo(schema.options)
  if (type === 'mixed') {
    return {
      ok: false,
      error: valibotToOpenAPIError(
        'Enum has mixed string and number values, please specify the OpenAPI type manually using `openapi({ type })`'
      ),
    } as const
  }
  return {
    ok: true,
    value: {
      ...mapNullableType(type === 'numeric' ? 'integer' : 'string'),
      enum: isNullable ? [...values, null] : values,
    },
  } as const
}
