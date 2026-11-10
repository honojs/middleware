import type { GenericSchema } from 'valibot'

/**
 * Structural views over the valibot schema objects this library reads. They are deliberately
 * narrower than valibot's own generic interfaces: only the fields the generator consumes.
 */
export type SchemaTypes = {
  readonly any: object
  readonly unknown: object
  readonly never: object
  readonly null: object
  readonly undefined: object
  readonly void: object
  readonly string: object
  readonly number: object
  readonly bigint: object
  readonly boolean: object
  readonly date: object
  readonly literal: { readonly literal: unknown }
  readonly picklist: { readonly options: readonly (string | number)[] }
  readonly enum: {
    readonly enum: { readonly [key: string]: string | number }
    readonly options: readonly (string | number)[]
  }
  readonly array: { readonly item: GenericSchema }
  readonly tuple: { readonly items: readonly GenericSchema[] }
  readonly strict_tuple: { readonly items: readonly GenericSchema[] }
  readonly loose_tuple: { readonly items: readonly GenericSchema[] }
  readonly tuple_with_rest: {
    readonly items: readonly GenericSchema[]
    readonly rest: GenericSchema
  }
  readonly object: { readonly entries: { readonly [key: string]: GenericSchema } }
  readonly loose_object: { readonly entries: { readonly [key: string]: GenericSchema } }
  readonly strict_object: { readonly entries: { readonly [key: string]: GenericSchema } }
  readonly object_with_rest: {
    readonly entries: { readonly [key: string]: GenericSchema }
    readonly rest: GenericSchema
  }
  readonly record: { readonly key: GenericSchema; readonly value: GenericSchema }
  readonly set: { readonly value: GenericSchema }
  readonly map: { readonly key: GenericSchema; readonly value: GenericSchema }
  readonly union: { readonly options: readonly GenericSchema[] }
  readonly variant: { readonly key: string; readonly options: readonly GenericSchema[] }
  readonly intersect: { readonly options: readonly GenericSchema[] }
  readonly optional: { readonly wrapped: GenericSchema; readonly default: unknown }
  readonly exact_optional: { readonly wrapped: GenericSchema; readonly default: unknown }
  readonly undefinedable: { readonly wrapped: GenericSchema; readonly default: unknown }
  readonly nullable: { readonly wrapped: GenericSchema; readonly default: unknown }
  readonly nullish: { readonly wrapped: GenericSchema; readonly default: unknown }
  readonly non_optional: { readonly wrapped: GenericSchema }
  readonly non_nullable: { readonly wrapped: GenericSchema }
  readonly non_nullish: { readonly wrapped: GenericSchema }
  readonly lazy: { readonly getter: (input: unknown) => GenericSchema }
}

export type SchemaTypeName = keyof SchemaTypes

export type SchemaOf<T extends SchemaTypeName> = T extends SchemaTypeName
  ? GenericSchema & { readonly type: T } & SchemaTypes[T]
  : never

export type PipeItem = {
  readonly kind: 'schema' | 'validation' | 'transformation' | 'metadata'
  readonly type: string
}

export type ValidationAction = PipeItem & {
  readonly kind: 'validation'
  readonly requirement?: unknown
}

export type MetadataAction = PipeItem & {
  readonly kind: 'metadata'
}

export type TransformationAction = PipeItem & {
  readonly kind: 'transformation'
}

export type PipedSchema = GenericSchema & { readonly pipe: readonly PipeItem[] }

export const WRAPPER_TYPES = [
  'optional',
  'exact_optional',
  'undefinedable',
  'nullable',
  'nullish',
  'non_optional',
  'non_nullable',
  'non_nullish',
] as const

export const OBJECT_TYPES = ['object', 'loose_object', 'strict_object', 'object_with_rest'] as const

export const TUPLE_TYPES = ['tuple', 'strict_tuple', 'loose_tuple', 'tuple_with_rest'] as const

/**
 * Returns `true` when the value is any valibot schema (`kind: 'schema'`).
 */
export function isSchema(value: unknown): value is GenericSchema {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    value.kind === 'schema' &&
    'type' in value &&
    typeof value.type === 'string' &&
    '~run' in value
  )
}

/**
 * Narrows a schema by its `type` discriminator.
 *
 * @example
 * isSchemaType(schema, 'string')
 * isSchemaType(schema, ['optional', 'nullable'])
 */
export function isSchemaType<T extends SchemaTypeName>(
  schema: GenericSchema,
  typeNames: T | readonly T[]
): schema is SchemaOf<T> {
  const names: readonly string[] = Array.isArray(typeNames) ? typeNames : [typeNames]
  return names.includes(schema.type)
}

/**
 * Returns `true` when the schema carries a `pipe` (created by `v.pipe`).
 */
export function isPiped(schema: GenericSchema): schema is PipedSchema {
  return 'pipe' in schema && Array.isArray(schema.pipe)
}

/**
 * Returns `true` for a validation action (`v.minLength`, `v.regex`, ...).
 */
export function isValidationAction(item: PipeItem): item is ValidationAction {
  return item.kind === 'validation'
}

/**
 * Returns `true` for a metadata action (`v.description`, `openapi`, ...).
 */
export function isMetadataAction(item: PipeItem): item is MetadataAction {
  return item.kind === 'metadata'
}

/**
 * Returns `true` for a transformation action (`v.transform`, `v.readonly`, ...).
 */
export function isTransformationAction(item: PipeItem): item is TransformationAction {
  return item.kind === 'transformation'
}

/**
 * Returns `true` for a pipe item that is itself a schema.
 */
export function isSchemaItem(item: PipeItem): item is PipeItem & GenericSchema {
  return item.kind === 'schema' && isSchema(item)
}
