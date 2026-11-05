import type { GenericSchema } from 'valibot'

import type { ValibotToOpenAPIError } from '../errors/index'
import { mapRecursive, transformSchema } from '../generator/index'
import { applySchemaMetadata, buildSchemaMetadata, collectMetadata } from '../metadata/index'
import { getDefaultValue, isNullableSchema, unwrapChained } from '../pipe/index'
import type { GenerationContext, ReferenceObject, SchemaObject } from '../types/index'
import { isEqual, isUndefined, omitBy, schemaRef } from '../utils/index'

/**
 * Everything the generator reads from one schema. Walking the pipe and the wrappers is the
 * expensive part of a generation, so it is done once here and threaded through the three
 * generation steps instead of being recomputed by each of them.
 */
function schemaInfo(schema: GenericSchema) {
  const collected = collectMetadata(schema)
  return {
    inner: unwrapChained(schema),
    metadata: omitBy(collected.metadata, isUndefined),
    refId: collected.internal.refId,
    defaultValue: getDefaultValue(schema),
    isNullable: isNullableSchema(schema),
  }
}

type SchemaInfo = ReturnType<typeof schemaInfo>

function toOpenAPISchema(ctx: GenerationContext, info: SchemaInfo) {
  return transformSchema(info.inner, info.isNullable, info.defaultValue, {
    specifics: ctx.specifics,
    options: ctx.options,
    mapItem: (item) => generateSchemaWithRef(ctx, item),
    generateSchemaRef: schemaRef,
  })
}

function generateSchemaWithMetadata(ctx: GenerationContext, info: SchemaInfo) {
  const { metadata, refId, isNullable } = info
  const existing = refId === undefined ? undefined : ctx.schemaRefs.get(refId)

  if (typeof existing === 'object') {
    return { ok: true, value: existing } as const
  }

  // A pending generation with this name means the schema is recursive: reference it directly.
  if (existing === 'pending' && refId !== undefined) {
    return {
      ok: true,
      value: ctx.specifics.mapNullableOfRef({ $ref: schemaRef(refId) }, isNullable),
    } as const
  }

  // Mark the ref as pending so recursive definitions can reference it. It is replaced by the
  // generated schema within `generateSchemaWithRef`.
  if (refId !== undefined && existing === undefined) {
    ctx.schemaRefs.set(refId, 'pending')
  }

  const result = metadata.type
    ? ({ ok: true, value: { type: metadata.type } } as const)
    : toOpenAPISchema(ctx, info)

  if (!result.ok) {
    return result
  }
  return { ok: true, value: applySchemaMetadata(result.value, metadata) } as const
}

/**
 * Same as `generateSchemaWithMetadata` but applies nullability to an already referenced schema.
 */
function constructReferencedOpenAPISchema(ctx: GenerationContext, info: SchemaInfo) {
  const { metadata, refId, defaultValue, isNullable } = info

  if (metadata.type) {
    return { ok: true, value: ctx.specifics.mapNullableType(metadata.type, isNullable) } as const
  }

  const existing = refId === undefined ? undefined : ctx.schemaRefs.get(refId)

  if (typeof existing === 'object') {
    return {
      ok: true,
      value: {
        ...mapRecursive(
          existing,
          (type) => ctx.specifics.mapNullableType(type, isNullable),
          (ref) => ctx.specifics.mapNullableOfRef(ref, isNullable)
        ),
        ...(defaultValue === undefined ? {} : { default: defaultValue }),
      },
    } as const
  }

  if (existing === 'pending' && refId !== undefined) {
    return {
      ok: true,
      value: ctx.specifics.mapNullableOfRef({ $ref: schemaRef(refId) }, isNullable),
    } as const
  }

  if (refId !== undefined && existing === undefined) {
    ctx.schemaRefs.set(refId, 'pending')
  }

  return toOpenAPISchema(ctx, info)
}

/**
 * Generates an OpenAPI SchemaObject or a ReferenceObject with all the provided metadata applied.
 */
function generateSimpleSchema(ctx: GenerationContext, info: SchemaInfo) {
  const { metadata, refId, isNullable } = info
  const existing = refId === undefined ? undefined : ctx.schemaRefs.get(refId)

  if (refId === undefined || existing === undefined) {
    return generateSchemaWithMetadata(ctx, info)
  }

  const referenceObject: ReferenceObject = { $ref: schemaRef(refId) }

  // We are currently calculating this schema or there is nothing
  if (existing === 'pending') {
    return { ok: true, value: ctx.specifics.mapNullableOfRef(referenceObject, isNullable) } as const
  }

  const differsFromRegistered = (value: unknown, key: string) =>
    value === undefined || isEqual(value, Reflect.get(existing, key))

  // Metadata provided from `openapi()` that is new to what we had already registered
  const newMetadata = omitBy(buildSchemaMetadata(metadata), differsFromRegistered)

  // Do not calculate schema metadata overrides if type is provided in `openapi()`
  if (newMetadata.type) {
    return { ok: true, value: { allOf: [referenceObject, newMetadata] } } as const
  }

  // New metadata from the valibot schema's own properties (nullable, default, ...)
  const referenced = constructReferencedOpenAPISchema(ctx, info)
  if (!referenced.ok) {
    return referenced
  }
  const newSchemaMetadata = omitBy(referenced.value, differsFromRegistered)

  const appliedMetadata = applySchemaMetadata(newSchemaMetadata, newMetadata)

  return {
    ok: true,
    value:
      Object.keys(appliedMetadata).length > 0
        ? { allOf: [referenceObject, appliedMetadata] }
        : referenceObject,
  } as const
}

/**
 * Generates the schema and, when it carries a `refId`, registers it under
 * `components.schemas` and returns a `$ref` instead of the inline schema.
 */
// The return type breaks the inference cycle of the mutual recursion through `mapItem`.
export function generateSchemaWithRef(
  ctx: GenerationContext,
  schema: GenericSchema
):
  | { readonly ok: true; readonly value: SchemaObject | ReferenceObject }
  | { readonly ok: false; readonly error: ValibotToOpenAPIError } {
  const info = schemaInfo(schema)
  const { refId } = info
  if (refId !== undefined && !ctx.schemaRefs.has(refId)) {
    const result = generateSimpleSchema(ctx, info)
    if (!result.ok) {
      return result
    }
    ctx.schemaRefs.set(refId, result.value)
    return { ok: true, value: { $ref: schemaRef(refId) } } as const
  }
  return generateSimpleSchema(ctx, info)
}

/**
 * Registered schemas, excluding any still marked as pending.
 */
export function filteredSchemaRefs(ctx: GenerationContext) {
  return Object.fromEntries(
    [...ctx.schemaRefs.entries()].flatMap(([refId, value]) =>
      value === 'pending' ? [] : [[refId, value] as const]
    )
  )
}
