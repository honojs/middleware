import type { GenericSchema } from 'valibot'

import { collect, conflictError, missingParameterDataError } from '../errors/index'
import { isSchemaType, OBJECT_TYPES } from '../guard/index'
import {
  buildParameterMetadata,
  getInternalMetadata,
  getOpenApiMetadata,
  getParamMetadata,
  getRefId,
} from '../metadata/index'
import { isNullableSchema, isOptionalSchema } from '../pipe/index'
import type {
  GenerationContext,
  ParameterLocation,
  ParameterObject,
  ReferenceObject,
} from '../types/index'
import { compact, parameterRef } from '../utils/index'
import { generateSchemaWithRef } from './schema'

type ParameterData = {
  readonly in?: ParameterLocation
  readonly name?: string
}

function getParameterRef(ctx: GenerationContext, schema: GenericSchema, external?: ParameterData) {
  const parameterMetadata = getOpenApiMetadata(schema).param
  const refId = getInternalMetadata(schema).refId
  const existingRef = refId === undefined ? undefined : ctx.paramRefs.get(refId)

  if (refId === undefined || existingRef === undefined) {
    return { ok: true, value: undefined } as const
  }

  if (
    (parameterMetadata && existingRef.in !== parameterMetadata.in) ||
    (external?.in && existingRef.in !== external.in)
  ) {
    return {
      ok: false,
      error: conflictError(
        `Conflicting location for parameter ${existingRef.name}. Use the same \`in\` in the route request and in \`openapi({ param: { in } })\``,
        {
          key: 'in',
          values: compact([existingRef.in, external?.in, parameterMetadata?.in]),
        }
      ),
    } as const
  }

  if (
    (parameterMetadata && existingRef.name !== parameterMetadata.name) ||
    (external?.name && existingRef.name !== external.name)
  ) {
    return {
      ok: false,
      error: conflictError(
        'Conflicting names for parameter. Use the same key in the route object and in `openapi({ param: { name } })`',
        {
          key: 'name',
          values: compact([existingRef.name, external?.name, parameterMetadata?.name]),
        }
      ),
    } as const
  }

  return { ok: true, value: { $ref: parameterRef(refId) } } as const
}

/**
 * Builds a parameter without `name` / `in`, shared by query/path/header parameters and
 * response headers.
 */
export function generateSimpleParameter(
  ctx: GenerationContext,
  schema: GenericSchema,
  externalParamMetadata?: ParameterData
) {
  const paramMetadata = getParamMetadata(schema).param
  const mergedParamMetadata = { ...paramMetadata, ...externalParamMetadata }
  const required = !isOptionalSchema(schema) && !isNullableSchema(schema)
  const generated = generateSchemaWithRef(ctx, schema)
  if (!generated.ok) {
    return generated
  }
  return {
    ok: true,
    value: {
      schema: generated.value,
      required,
      ...(Object.keys(mergedParamMetadata).length > 0
        ? buildParameterMetadata(mergedParamMetadata)
        : {}),
    },
  } as const
}

/**
 * Builds a full ParameterObject; `name` / `in` come from the route context or `param` metadata.
 */
export function generateParameter(
  ctx: GenerationContext,
  schema: GenericSchema,
  externalParamMetadata?: ParameterData
) {
  const paramMetadata = getOpenApiMetadata(schema).param
  const paramName = externalParamMetadata?.name ?? paramMetadata?.name
  const paramLocation = externalParamMetadata?.in ?? paramMetadata?.in

  if (!paramName) {
    return { ok: false, error: missingParameterDataError({ missingField: 'name' }) } as const
  }
  if (!paramLocation) {
    return {
      ok: false,
      error: missingParameterDataError({ missingField: 'in', paramName }),
    } as const
  }

  const simple = generateSimpleParameter(ctx, schema, externalParamMetadata)
  if (!simple.ok) {
    return simple
  }
  return {
    ok: true,
    value: {
      ...simple.value,
      in: paramLocation,
      name: paramName,
    },
  } as const
}

/**
 * Generates a registered parameter (`registerParameter`) into `components.parameters`.
 */
export function generateParameterDefinition(ctx: GenerationContext, schema: GenericSchema) {
  const refId = getRefId(schema)
  const result = generateParameter(ctx, schema)
  if (result.ok && refId !== undefined) {
    ctx.paramRefs.set(refId, result.value)
  }
  return result
}

/**
 * Expands a route parameter schema into one ParameterObject per object entry (or a single
 * parameter for a non-object schema), resolving registered parameters to `$ref`s.
 */
export function generateInlineParameters(
  ctx: GenerationContext,
  schema: GenericSchema,
  location: ParameterLocation
) {
  const parameterMetadata = getOpenApiMetadata(schema).param
  const referencedSchema = getParameterRef(ctx, schema, { in: location })
  if (!referencedSchema.ok) {
    return referencedSchema
  }

  if (referencedSchema.value) {
    return { ok: true, value: [referencedSchema.value] } as const
  }

  if (isSchemaType(schema, OBJECT_TYPES)) {
    const entries = collect<ParameterObject | ReferenceObject>(
      Object.entries(schema.entries).map(([key, entry]) => {
        const innerParameterMetadata = getOpenApiMetadata(entry).param
        const referencedEntry = getParameterRef(ctx, entry, { in: location, name: key })
        if (!referencedEntry.ok) {
          return referencedEntry
        }

        if (referencedEntry.value) {
          return { ok: true, value: referencedEntry.value } as const
        }

        if (innerParameterMetadata?.name && innerParameterMetadata.name !== key) {
          return {
            ok: false,
            error: conflictError(
              'Conflicting names for parameter. Use the same key in the route object and in `openapi({ param: { name } })`',
              { key: 'name', values: [key, innerParameterMetadata.name] }
            ),
          } as const
        }

        if (innerParameterMetadata?.in && innerParameterMetadata.in !== location) {
          return {
            ok: false,
            error: conflictError(
              `Conflicting location for parameter ${innerParameterMetadata.name ?? key}. Use the same \`in\` in the route request and in \`openapi({ param: { in } })\``,
              { key: 'in', values: [location, innerParameterMetadata.in] }
            ),
          } as const
        }

        return generateParameter(ctx, entry, { name: key, in: location })
      })
    )
    if (!entries.ok) {
      return entries
    }
    return { ok: true, value: [...entries.value] } as const
  }

  if (parameterMetadata?.in && parameterMetadata.in !== location) {
    return {
      ok: false,
      error: conflictError(
        `Conflicting location for parameter ${parameterMetadata.name}. Use the same \`in\` in the route request and in \`openapi({ param: { in } })\``,
        { key: 'in', values: [location, parameterMetadata.in] }
      ),
    } as const
  }

  const single = generateParameter(ctx, schema, { in: location })
  if (!single.ok) {
    return single
  }
  return { ok: true, value: [single.value] } as const
}
