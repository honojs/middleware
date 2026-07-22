import type { getOpenApiMetadata } from '@asteasolutions/zod-to-openapi'
import type { StandardJSONSchemaV1, StandardSchemaV1 } from '@standard-schema/spec'
import { z } from 'zod'
import { isZod } from './zod-typeguard'

/**
 * A schema exposing both halves this package needs: `validate` (request middleware) and
 * `jsonSchema` (the document). Zod 4 and ArkType ship both; Valibot needs
 * `toStandardJsonSchema()`. See https://standardschema.dev/json-schema.
 */
export interface StandardOpenAPISchema<Input = unknown, Output = Input> {
  readonly '~standard': StandardSchemaV1.Props<Input, Output> &
    StandardJSONSchemaV1.Props<Input, Output>
}

/** A JSON Schema dialect a Standard Schema library may be asked to emit. */
export type JSONSchemaTarget = StandardJSONSchemaV1.Target

type JSONSchema = Record<string, unknown>

/** The metadata `.openapi()` accepts, merged over the schema Zod generates. */
type OpenApiMetadata = ReturnType<typeof getOpenApiMetadata>

/**
 * JSON Schema dialects to try per OpenAPI version, in order. 3.1 is draft-2020-12 already; 3.0
 * tries `openapi-3.0` first, then `draft-07` for libraries that only emit drafts (e.g. ArkType).
 */
export const TARGETS: Record<'3.0' | '3.1', JSONSchemaTarget[]> = {
  '3.0': ['openapi-3.0', 'draft-07'],
  '3.1': ['draft-2020-12'],
}

/** Whether the value validates and describes itself as JSON Schema, whichever library made it. */
const isStandardJSONSchema = (x: unknown): x is StandardOpenAPISchema => {
  // `function` is allowed: `type({ ... })` returns a callable with `~standard` hung off it.
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

/** Converts to JSON Schema, trying each target until one is accepted; reports all rejections. */
const toJSONSchema = (
  schema: StandardOpenAPISchema,
  kind: 'input' | 'output',
  targets: JSONSchemaTarget[]
): JSONSchema => {
  const errors: string[] = []

  for (const target of targets) {
    try {
      // Drop `$schema`: meaningful for a standalone document, not for an embedded operation.
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
 * Hides a foreign JSON Schema inside a Zod carrier so `@asteasolutions/zod-to-openapi` emits a
 * schema it never produced. `.openapi()` metadata is merged over it, so every output key is ours.
 */
const carry = (jsonSchema: JSONSchema): z.ZodString =>
  // `z.string()`, not `z.any()`: Zod treats `any` as accepting `undefined`, making every rebuilt
  // required parameter come out `required: false`.
  z.string().openapi(jsonSchema as OpenApiMetadata)

/** Converts a request-body or response schema into a single carrier (content is emitted whole). */
const toContentSchema = (
  schema: StandardOpenAPISchema,
  kind: 'input' | 'output',
  targets: JSONSchemaTarget[]
): z.ZodString => carry(toJSONSchema(schema, kind, targets))

/**
 * Rebuilds an object schema as a Zod object of per-property carriers, for parameters (path,
 * query, header, cookie) — the generator splits the object and reads each property off the Zod type.
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

/** Whether the schema must be converted before the registry sees it. Zod passes through untouched. */
export const needsConversion = (schema: unknown): schema is StandardOpenAPISchema =>
  !isZod(schema) && isStandardJSONSchema(schema)

/** Only the parts of a route this module reads. Structural, so `index.ts` avoids a circular import. */
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

/** Whether the route carries a non-Zod schema, which decides if it must wait for a target. */
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

/** Returns the route with every non-Zod schema swapped for a Zod carrier; Zod schemas pass through. */
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
                    // A request body is what the client sends, so it is the input type.
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
