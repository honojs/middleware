import type { getOpenApiMetadata } from '@asteasolutions/zod-to-openapi'
import type { StandardJSONSchemaV1, StandardSchemaV1 } from '@standard-schema/spec'
import { z } from 'zod'
import { isZod } from './zod-typeguard'

/**
 * A schema with both halves this package needs: `validate` for the request middleware and
 * `jsonSchema` for the document. See https://standardschema.dev/json-schema.
 *
 * Zod 4 and ArkType ship both natively; Valibot only gets `jsonSchema` once it is wrapped
 * with `toStandardJsonSchema()` from `@valibot/to-json-schema`.
 */
export interface StandardOpenAPISchema<Input = unknown, Output = Input> {
  readonly '~standard': StandardSchemaV1.Props<Input, Output> &
    StandardJSONSchemaV1.Props<Input, Output>
}

/** A JSON Schema dialect a Standard Schema library may be asked to emit. */
export type JSONSchemaTarget = StandardJSONSchemaV1.Target

type JSONSchema = Record<string, unknown>

/** The metadata `.openapi()` accepts, which is merged over the schema Zod generates. */
type OpenApiMetadata = ReturnType<typeof getOpenApiMetadata>

/**
 * Default targets to try per OpenAPI version, in order.
 *
 * The spec lets a library throw for targets it does not implement, and support is uneven:
 * Zod emits `openapi-3.0`, while ArkType throws `JSONSchema target 'openapi-3.0' is not
 * supported (must be "draft-2020-12" or "draft-07")`. Without the `draft-07` fallback,
 * `doc()` would be unusable for those libraries — draft-07 is close to the draft-04 that
 * OpenAPI 3.0 builds on, so most schemas survive, but constructs 3.0 lacks pass through
 * unconverted. 3.1 already is draft-2020-12, so it needs no fallback.
 *
 * Override per app with `jsonSchemaTargets` on `OpenAPIHono` when a library only supports
 * a specific dialect (e.g. ArkType → `{ '3.0': ['draft-07'] }`).
 */
export const TARGETS: Record<'3.0' | '3.1', JSONSchemaTarget[]> = {
  '3.0': ['openapi-3.0', 'draft-07'],
  '3.1': ['draft-2020-12'],
}

/**
 * Whether the value validates and describes itself as JSON Schema, so we never have to know
 * which library produced it.
 */
const isStandardJSONSchema = (x: unknown): x is StandardOpenAPISchema => {
  // `typeof` has to allow 'function': `type({ ... })` returns a callable with `~standard`
  // hung off it, so an object-only check silently misses every ArkType schema.
  if ((typeof x !== 'object' && typeof x !== 'function') || x === null) {
    return false
  }
  const standard = (x as StandardOpenAPISchema)['~standard'] as
    Partial<StandardOpenAPISchema['~standard']> | undefined
  return (
    typeof standard?.validate === 'function' &&
    typeof standard?.jsonSchema?.input === 'function' &&
    typeof standard?.jsonSchema?.output === 'function'
  )
}

/**
 * Converts to JSON Schema, trying each target until one is accepted and keeping the
 * rejections so the error at the end can say what was tried and why each failed.
 */
const toJSONSchema = (
  schema: StandardOpenAPISchema,
  kind: 'input' | 'output',
  targets: JSONSchemaTarget[]
): JSONSchema => {
  const errors: string[] = []

  for (const target of targets) {
    try {
      // Drop `$schema`: it means something for a standalone schema document, but not for
      // one embedded in an operation (ArkType and Valibot both emit it on the drafts).
      const { $schema, ...jsonSchema } = schema['~standard'].jsonSchema[kind]({ target })
      return jsonSchema
    } catch (e) {
      errors.push(`${target}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  throw new Error(
    `"${schema['~standard'].vendor}" could not convert a schema to any target supported by this ` +
      `OpenAPI version (tried ${targets.join(', ')}).\n${errors.join('\n')}`
  )
}

/**
 * Hides a foreign JSON Schema inside a Zod carrier, so `@asteasolutions/zod-to-openapi` —
 * which reads Zod internals and understands nothing else — emits a schema it never produced.
 *
 * The carrier's own type never reaches the document: the generator merges `.openapi()`
 * metadata over whatever it generated, so every key in the output comes from `jsonSchema`.
 */
const carry = (jsonSchema: JSONSchema): z.ZodString =>
  // `z.string()` and not `z.any()`: Zod counts `any` as accepting `undefined`, so the
  // generator reads the property as optional and every required parameter rebuilt by
  // `toParameterSchema` would come out `required: false`.
  z.string().openapi(jsonSchema as OpenApiMetadata)

/**
 * Converts a request-body or response schema into a single carrier — content schemas are
 * emitted whole, so there is nothing to take apart.
 */
const toContentSchema = (
  schema: StandardOpenAPISchema,
  kind: 'input' | 'output',
  targets: JSONSchemaTarget[]
): z.ZodString => carry(toJSONSchema(schema, kind, targets))

/**
 * Rebuilds an object schema as a Zod object of carriers, one per property, for parameters
 * (path, query, header, cookie).
 *
 * These cannot reuse the flat carrier from `carry`: the generator splits the object into
 * one parameter per property and reads that shape off the Zod type, so a flat carrier dies
 * with "Missing parameter data, please specify `name` and other OpenAPI parameter props".
 */
const toParameterSchema = (
  schema: StandardOpenAPISchema,
  targets: JSONSchemaTarget[]
): z.ZodObject<Record<string, z.ZodString | z.ZodOptional<z.ZodString>>> => {
  // Parameters describe what the client sends, so they reflect the input type.
  const jsonSchema = toJSONSchema(schema, 'input', targets)
  const properties = (jsonSchema.properties ?? {}) as Record<string, JSONSchema>
  const required = (jsonSchema.required ?? []) as string[]

  return z.object(
    Object.fromEntries(
      Object.entries(properties).map(([name, property]) => [
        name,
        required.includes(name) ? carry(property) : carry(property).optional(),
      ])
    )
  )
}

/**
 * Whether the schema has to be converted before the registry sees it. Zod schemas never are
 * — they reach `@asteasolutions/zod-to-openapi` untouched, so registered refs
 * (`.openapi('User')`) and existing metadata keep resolving exactly as they did before.
 */
export const needsConversion = (schema: unknown): schema is StandardOpenAPISchema =>
  !isZod(schema) && isStandardJSONSchema(schema)

/** Only the parts of a route this module reads. Structural so `index.ts` can import from
 * here without the two files importing each other. */
type RouteLike = {
  request?: {
    body?: { content?: Record<string, { schema?: unknown } | undefined> }
    params?: unknown
    query?: unknown
    cookies?: unknown
    headers?: unknown
  }
  responses?: Record<
    string,
    { content?: Record<string, { schema?: unknown } | undefined>; headers?: unknown }
  >
}

const schemasOf = (route: RouteLike): unknown[] => [
  route.request?.params,
  route.request?.query,
  route.request?.cookies,
  ...(Array.isArray(route.request?.headers)
    ? (route.request.headers as unknown[])
    : [route.request?.headers]),
  ...Object.values(route.request?.body?.content ?? {}).map((media) => media?.schema),
  ...Object.values(route.responses ?? {}).flatMap((response) => [
    ...Object.values(response?.content ?? {}).map((media) => media?.schema),
    response?.headers,
  ]),
]

/**
 * Whether the route carries a schema from some library other than Zod, which decides
 * whether it can be registered eagerly or has to wait for a target (see `#standardRoutes`).
 */
export const routeUsesStandardSchema = (route: RouteLike): boolean =>
  schemasOf(route).some(needsConversion)

const convertContent = (
  content: Record<string, { schema?: unknown } | undefined> | undefined,
  kind: 'input' | 'output',
  targets: JSONSchemaTarget[]
) =>
  content &&
  Object.fromEntries(
    Object.entries(content).map(([mediaType, media]) => [
      mediaType,
      media && needsConversion(media.schema)
        ? { ...media, schema: toContentSchema(media.schema, kind, targets) }
        : media,
    ])
  )

const convertParameter = (schema: unknown, targets: JSONSchemaTarget[]) =>
  needsConversion(schema) ? toParameterSchema(schema, targets) : schema

/**
 * Returns the route with every non-Zod schema swapped for a Zod carrier, so the whole route
 * can go through `@asteasolutions/zod-to-openapi` unchanged. Zod schemas are passed along
 * as they are.
 */
export const convertRouteSchemas = <R extends RouteLike>(
  route: R,
  targets: JSONSchemaTarget[]
): R => {
  const { request, responses } = route

  return {
    ...route,
    ...(request
      ? {
          request: {
            ...request,
            ...(request.params ? { params: convertParameter(request.params, targets) } : {}),
            ...(request.query ? { query: convertParameter(request.query, targets) } : {}),
            ...(request.cookies ? { cookies: convertParameter(request.cookies, targets) } : {}),
            ...(request.headers
              ? {
                  headers: Array.isArray(request.headers)
                    ? request.headers.map((header) => convertParameter(header, targets))
                    : convertParameter(request.headers, targets),
                }
              : {}),
            ...(request.body
              ? {
                  body: {
                    ...request.body,
                    // A request body is what the client sends, so it is the input type —
                    // a field with a default is optional here and guaranteed on the way out.
                    content: convertContent(request.body.content, 'input', targets),
                  },
                }
              : {}),
          },
        }
      : {}),
    ...(responses
      ? {
          responses: Object.fromEntries(
            Object.entries(responses).map(([status, response]) => [
              status,
              {
                ...response,
                // A response is what the server sends, so it is the output type.
                content: convertContent(response?.content, 'output', targets),
                ...(response?.headers
                  ? { headers: convertParameter(response.headers, targets) }
                  : {}),
              },
            ])
          ),
        }
      : {}),
  } as R
}
