import type { GenericSchema } from 'valibot'
import { is } from 'valibot'

import type { PipeItem, SchemaOf, ValidationAction } from '../guard/index'
import {
  isPiped,
  isSchemaItem,
  isSchemaType,
  isTransformationAction,
  isValidationAction,
  WRAPPER_TYPES,
} from '../guard/index'

/**
 * Flattens the actions of a piped schema depth-first, in declaration order. Nested `v.pipe`
 * schemas are expanded in place; schemas without a pipe yield nothing.
 *
 * @example
 * flattenPipe(v.pipe(v.pipe(v.string(), v.minLength(1)), v.maxLength(5)))
 * // [minLengthAction, maxLengthAction]
 */
// Recursive: without the annotation the return type resolves to `any`.
export function flattenPipe(schema: GenericSchema): readonly PipeItem[] {
  if (!isPiped(schema)) {
    return []
  }
  return schema.pipe.flatMap((item) => (isSchemaItem(item) ? flattenPipe(item) : [item]))
}

/**
 * Validation actions that apply to the schema's input, i.e. every validation that appears
 * before the first transformation. Validations after a transformation constrain the transformed
 * value, which is not what the OpenAPI document describes.
 */
export function inputValidations(schema: GenericSchema) {
  const items = flattenPipe(schema)
  const transformIndex = items.findIndex(isTransformationAction)
  const inputItems = transformIndex === -1 ? items : items.slice(0, transformIndex)
  return inputItems.filter(isValidationAction)
}

/**
 * Finds the first validation action of the given type in an already collected list.
 */
export function findValidation(validations: readonly ValidationAction[], type: string) {
  return validations.find((action) => action.type === type)
}

/**
 * Returns `true` when any validation of the given type is present.
 */
export function hasValidation(validations: readonly ValidationAction[], type: string) {
  return validations.some((action) => action.type === type)
}

/**
 * The numeric `requirement` of the first validation of the given type, if any.
 */
export function requirementNumber(validations: readonly ValidationAction[], type: string) {
  const requirement = findValidation(validations, type)?.requirement
  return typeof requirement === 'number' ? requirement : undefined
}

/**
 * Returns `true` for `v.optional` / `v.nullable` / `v.nullish` / ... wrappers.
 */
export function isWrapper(
  schema: GenericSchema
): schema is SchemaOf<(typeof WRAPPER_TYPES)[number]> {
  return isSchemaType(schema, WRAPPER_TYPES)
}

/**
 * Strips every wrapper (`v.optional`, `v.nullable`, ...) and returns the innermost schema.
 * `v.pipe` wrappers are transparent because a piped schema keeps the `type` of its first entry.
 */
// Recursive: without the annotation the return type resolves to `any`.
export function unwrapChained(schema: GenericSchema): GenericSchema {
  return isWrapper(schema) ? unwrapChained(schema.wrapped) : schema
}

/**
 * Strips only `v.nullable` / `v.nullish` wrappers.
 */
// Recursive: without the annotation the return type resolves to `any`.
export function unwrapNullable(schema: GenericSchema): GenericSchema {
  return isSchemaType(schema, ['nullable', 'nullish']) ? unwrapNullable(schema.wrapped) : schema
}

function isDefaultFactory(value: unknown): value is () => unknown {
  return typeof value === 'function'
}

function resolveDefault(value: unknown) {
  return isDefaultFactory(value) ? value() : value
}

/**
 * The default value of the outermost wrapper that declares one.
 *
 * @example
 * getDefaultValue(v.optional(v.string(), 'x')) // 'x'
 */
export function getDefaultValue(schema: GenericSchema) {
  if (!isWrapper(schema)) {
    return undefined
  }
  const value = 'default' in schema ? resolveDefault(schema.default) : undefined
  if (value !== undefined) {
    return value
  }
  return getDefaultValue(schema.wrapped)
}

/**
 * Returns `true` when the schema accepts `null`.
 */
export function isNullableSchema(schema: GenericSchema) {
  return is(schema, null)
}

/**
 * Returns `true` when the schema accepts `undefined` (or declares the key as omittable).
 */
export function isOptionalSchema(schema: GenericSchema) {
  return isSchemaType(schema, ['optional', 'exact_optional', 'nullish']) || is(schema, undefined)
}
