import type { StandardJSONSchemaV1, StandardSchemaV1 } from '@standard-schema/spec'

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

/** A JSON Schema document, as emitted by a Standard Schema library. */
export type JSONSchema = Record<string, unknown>

/** Which of a schema's two faces to describe: what comes in, or what goes out. */
export type SchemaKind = 'input' | 'output'

/** Whether the value validates and describes itself as JSON Schema, whichever library made it. */
export const isStandardJSONSchema = (x: unknown): x is StandardOpenAPISchema => {
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
export const toJSONSchema = (
  schema: StandardOpenAPISchema,
  kind: SchemaKind,
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
