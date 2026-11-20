import { isSchema } from '../guard/index'
import type {
  ComponentTypeKey,
  Definition,
  GenerationContext,
  OpenAPIComponentObject,
  OpenAPIDefinition,
  ParameterObject,
  ReferenceObject,
  SchemaObject,
} from '../types/index'
import { isReferenceObject, sortObjectByKeys } from '../utils/index'
import { generateParameterDefinition } from './parameter'
import { generateSingleRoute } from './route'
import { filteredSchemaRefs, generateSchemaWithRef } from './schema'

const GENERATION_ORDER: readonly OpenAPIDefinition['type'][] = [
  'schema',
  'parameter',
  'component',
  'route',
  'webhook',
]

function generationIndex(definition: Definition) {
  // A plain valibot schema has no `type: 'schema' | ...` tag => highest priority.
  return isSchema(definition) ? -1 : GENERATION_ORDER.indexOf(definition.type)
}

/**
 * Orders definitions so schemas are generated before the parameters / routes that reference
 * them. The sort is stable, so registration order is preserved within each group.
 */
export function sortDefinitions(definitions: readonly Definition[]) {
  return [...definitions].sort((left, right) => generationIndex(left) - generationIndex(right))
}

function generateSingle(ctx: GenerationContext, definition: Definition) {
  if (isSchema(definition)) {
    return generateSchemaWithRef(ctx, definition)
  }
  if (definition.type === 'parameter') {
    return generateParameterDefinition(ctx, definition.schema)
  }
  if (definition.type === 'schema') {
    return generateSchemaWithRef(ctx, definition.schema)
  }
  if (definition.type === 'route') {
    return generateSingleRoute(ctx, definition.route, 'paths')
  }
  if (definition.type === 'webhook') {
    return generateSingleRoute(ctx, definition.webhook, 'webhooks')
  }
  ctx.rawComponents.push(definition)
  return { ok: true, value: undefined } as const
}

function isSchemaComponent(value: OpenAPIComponentObject): value is SchemaObject | ReferenceObject {
  return typeof value === 'object' && value !== null
}

function isParameterComponent(
  value: OpenAPIComponentObject
): value is ParameterObject | ReferenceObject {
  return (
    typeof value === 'object' && (isReferenceObject(value) || ('name' in value && 'in' in value))
  )
}

function rawComponentsOf<T extends OpenAPIComponentObject>(
  ctx: GenerationContext,
  componentType: ComponentTypeKey,
  guard: (value: OpenAPIComponentObject) => value is T
) {
  return Object.fromEntries(
    ctx.rawComponents
      .filter((raw) => raw.componentType === componentType)
      .flatMap((raw) => (guard(raw.component) ? [[raw.name, raw.component] as const] : []))
  )
}

function buildComponents(ctx: GenerationContext) {
  const sort = ctx.options?.sortComponents === 'alphabetically'
  const order = <T>(entries: { readonly [key: string]: T }) =>
    sort ? sortObjectByKeys(entries) : entries

  // Raw components are entirely under the user's control, so they are passed through as-is.
  // `schemas` and `parameters` are built below instead: they also carry the generated ones.
  return {
    ...Object.fromEntries(
      [...new Set(ctx.rawComponents.map((raw) => raw.componentType))]
        .filter((componentType) => componentType !== 'schemas' && componentType !== 'parameters')
        .map((componentType) => [
          componentType,
          Object.fromEntries(
            ctx.rawComponents
              .filter((raw) => raw.componentType === componentType)
              .map((raw) => [raw.name, raw.component] as const)
          ),
        ])
    ),
    schemas: order({
      ...rawComponentsOf(ctx, 'schemas', isSchemaComponent),
      ...filteredSchemaRefs(ctx),
    }),
    parameters: order({
      ...rawComponentsOf(ctx, 'parameters', isParameterComponent),
      ...Object.fromEntries(ctx.paramRefs),
    }),
  }
}

/**
 * Runs every definition through the context and returns the document fragments.
 */
export function generateDocumentData(ctx: GenerationContext, definitions: readonly Definition[]) {
  for (const definition of sortDefinitions(definitions)) {
    const result = generateSingle(ctx, definition)
    if (!result.ok) {
      return result
    }
  }
  return {
    ok: true,
    value: {
      components: buildComponents(ctx),
      paths: Object.fromEntries(ctx.pathRefs),
      webhooks: Object.fromEntries(ctx.webhookRefs),
    },
  } as const
}
