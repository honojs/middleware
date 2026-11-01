import type { BaseMetadata, GenericSchema } from 'valibot'

import type { MetadataAction } from '../guard/index'
import { isMetadataAction } from '../guard/index'
import { flattenPipe, isWrapper } from '../pipe/index'
import type {
  FullMetadata,
  InternalMetadata,
  OpenAPIMetadata,
  OpenApiOptions,
  ReferenceObject,
  SchemaObject,
} from '../types/index'
import { isObject, isUndefined, omitBy } from '../utils/index'

/**
 * Metadata action produced by `openapi()`. It is a regular valibot metadata pipe item, so it
 * composes with `v.pipe` like `v.description` or `v.title`.
 */
export type OpenapiAction<TInput> = BaseMetadata<TInput> & {
  readonly type: 'openapi'
  readonly reference: typeof openapi
  readonly metadata: OpenAPIMetadata<TInput>
  readonly refId: string | undefined
  readonly options: OpenApiOptions | undefined
}

/**
 * Attaches OpenAPI metadata (and optionally a component `refId`) to a valibot schema.
 *
 * @example
 * v.pipe(v.string(), openapi({ description: 'The entity id' }))
 * v.pipe(v.object({ name: v.string() }), openapi('User'))
 * v.pipe(v.union([...]), openapi('Pet', {}, { unionPreferredType: 'oneOf' }))
 */
export function openapi<TInput>(
  metadata: OpenAPIMetadata<NoInfer<TInput>>,
  options?: OpenApiOptions
): OpenapiAction<TInput>
export function openapi<TInput>(
  refId: string,
  metadata?: OpenAPIMetadata<NoInfer<TInput>>,
  options?: OpenApiOptions
): OpenapiAction<TInput>
// The second argument is either metadata (refId form) or options (metadata form); the
// intersection lets both overloads share one implementation without a cast.
export function openapi<TInput>(
  refOrMetadata: string | OpenAPIMetadata<TInput>,
  metadataOrOptions?: OpenAPIMetadata<TInput> & OpenApiOptions,
  options?: OpenApiOptions
) {
  const config =
    typeof refOrMetadata === 'string'
      ? { refId: refOrMetadata, metadata: metadataOrOptions ?? {}, options }
      : { refId: undefined, metadata: refOrMetadata, options: metadataOrOptions }
  return {
    kind: 'metadata',
    type: 'openapi',
    reference: openapi,
    metadata: config.metadata,
    refId: config.refId,
    options: config.options,
  }
}

function isOpenapiAction(item: MetadataAction): item is MetadataAction & OpenapiAction<unknown> {
  return item.type === 'openapi' && 'metadata' in item
}

export type CollectedMetadata = {
  readonly metadata: FullMetadata
  readonly internal: InternalMetadata
}

const EMPTY: CollectedMetadata = { metadata: {}, internal: {} }

function mergeCollected(base: CollectedMetadata, override: CollectedMetadata) {
  const param = { ...base.metadata.param, ...override.metadata.param }
  return {
    metadata: {
      ...base.metadata,
      ...override.metadata,
      ...(Object.keys(param).length > 0 ? { param } : {}),
    },
    internal: { ...base.internal, ...override.internal },
  }
}

function metadataOfAction(item: MetadataAction) {
  if (isOpenapiAction(item)) {
    return {
      metadata: item.metadata,
      internal: {
        ...item.options,
        ...(item.refId === undefined ? {} : { refId: item.refId }),
      },
    }
  }
  if (
    item.type === 'description' &&
    'description' in item &&
    typeof item.description === 'string'
  ) {
    return { metadata: { description: item.description }, internal: {} }
  }
  if (item.type === 'title' && 'title' in item && typeof item.title === 'string') {
    return { metadata: { title: item.title }, internal: {} }
  }
  if (item.type === 'examples' && 'examples' in item && Array.isArray(item.examples)) {
    return { metadata: { examples: item.examples }, internal: {} }
  }
  if (item.type === 'metadata' && 'metadata' in item && isObject(item.metadata)) {
    return { metadata: item.metadata, internal: {} }
  }
  return EMPTY
}

/**
 * Metadata declared directly on the schema's own pipe (not on wrapped schemas).
 */
function ownMetadata(schema: GenericSchema) {
  return flattenPipe(schema)
    .filter(isMetadataAction)
    .reduce((acc, item) => mergeCollected(acc, metadataOfAction(item)), EMPTY)
}

/**
 * Collects the OpenAPI metadata of a schema, walking through `v.optional` / `v.nullable` / ...
 * wrappers. Metadata declared on an outer wrapper overrides the wrapped schema's.
 */
// Recursive: without the annotation the return type resolves to `any`.
export function collectMetadata(schema: GenericSchema): CollectedMetadata {
  const own = ownMetadata(schema)
  return isWrapper(schema) ? mergeCollected(collectMetadata(schema.wrapped), own) : own
}

/**
 * The OpenAPI metadata of a schema with `undefined` values dropped.
 */
export function getOpenApiMetadata(schema: GenericSchema) {
  return omitBy(collectMetadata(schema).metadata, isUndefined)
}

/**
 * The library-internal metadata (`refId`, `unionPreferredType`).
 */
export function getInternalMetadata(schema: GenericSchema) {
  return collectMetadata(schema).internal
}

/**
 * The component name the schema was registered under, if any.
 */
export function getRefId(schema: GenericSchema) {
  return getInternalMetadata(schema).refId
}

/**
 * Metadata for parameter generation: a `description` from `openapi()` is taken with lower
 * precedence than one from `param.description`.
 */
export function getParamMetadata(schema: GenericSchema) {
  const metadata = collectMetadata(schema).metadata
  return {
    ...metadata,
    param: {
      ...(metadata.description === undefined ? {} : { description: metadata.description }),
      ...metadata.param,
    },
  }
}

/**
 * Keeps only the keys that belong to a SchemaObject (drops `param` and `undefined` values).
 */
export function buildSchemaMetadata(metadata: FullMetadata) {
  return omitBy(metadata, (value, key) => key === 'param' || value === undefined)
}

/**
 * Drops `undefined` values from parameter metadata.
 */
export function buildParameterMetadata(metadata: NonNullable<OpenAPIMetadata['param']>) {
  return omitBy(metadata, isUndefined)
}

/**
 * Merges the user-provided metadata over a generated schema.
 */
export function applySchemaMetadata(
  initialData: SchemaObject | ReferenceObject,
  metadata: FullMetadata
) {
  return omitBy({ ...initialData, ...buildSchemaMetadata(metadata) }, isUndefined)
}
