import type {
  ComponentsObject,
  ContentObject as OASContentObject,
  HeadersObject,
  OpenAPIObject,
  OperationObject,
  ParameterLocation,
  ParameterObject,
  PathsObject,
  ReferenceObject,
  ResponseObject,
  ResponsesObject,
  SchemaObject,
} from 'openapi3-ts/oas31'
import type { ContentObject, RouteConfig, RouteSchema } from './route-config'
import type {
  JSONSchema,
  JSONSchemaTarget,
  SchemaKind,
  StandardOpenAPISchema,
} from './standard-schema'
import { isStandardJSONSchema, toJSONSchema } from './standard-schema'
import { stableStringify, toArray } from './utils'

/**
 * JSON Schema dialects to try per OpenAPI version, in order. 3.1 is draft-2020-12 already; 3.0
 * tries `openapi-3.0` first, then `draft-07` for libraries that only emit drafts (e.g. ArkType).
 */
export const TARGETS: Record<'3.0' | '3.1', JSONSchemaTarget[]> = {
  '3.0': ['openapi-3.0', 'draft-07'],
  '3.1': ['draft-2020-12'],
}

export type OpenAPIObjectConfig = Omit<OpenAPIObject, 'paths' | 'components' | 'webhooks'>

export type ComponentType = keyof ComponentsObject

export type Definition =
  | { type: 'schema'; name: string; schema: StandardOpenAPISchema }
  | { type: 'component'; componentType: ComponentType; name: string; component: object }
  | { type: 'route'; route: RouteConfig }
  | { type: 'webhook'; webhook: RouteConfig }

/** What a document is built from. Sub-apps merge by copying definitions across. */
export class OpenAPIRegistry {
  definitions: Definition[] = []

  /** Names a schema so every use of it becomes a `$ref` into `components.schemas`. */
  register<S extends StandardOpenAPISchema>(name: string, schema: S): S {
    this.definitions.push({ type: 'schema', name, schema })
    return schema
  }

  registerComponent(
    componentType: ComponentType,
    name: string,
    component: object
  ): { name: string; ref: ReferenceObject } {
    this.definitions.push({ type: 'component', componentType, name, component })
    return { name, ref: { $ref: `#/components/${componentType}/${name}` } }
  }

  registerParameter(name: string, parameter: ParameterObject): ReferenceObject {
    return this.registerComponent('parameters', name, parameter).ref
  }

  registerPath(route: RouteConfig): void {
    this.definitions.push({ type: 'route', route })
  }

  registerWebhook(webhook: RouteConfig): void {
    this.definitions.push({ type: 'webhook', webhook })
  }
}

const PARAMETER_SOURCES = [
  ['params', 'path'],
  ['query', 'query'],
  ['headers', 'header'],
  ['cookies', 'cookie'],
] as const satisfies readonly (readonly [string, ParameterLocation])[]

export const generateDocument = (
  definitions: Definition[],
  config: OpenAPIObjectConfig,
  version: '3.0' | '3.1',
  targetOverride?: JSONSchemaTarget[]
): OpenAPIObject => {
  const builder = new DocumentBuilder(targetOverride ?? TARGETS[version])

  // Named schemas first, so a route that uses one already sees the `$ref`.
  for (const definition of definitions) {
    if (definition.type === 'schema') {
      builder.name(definition.name, definition.schema)
    }
  }

  const components: ComponentsObject = {}
  const paths: PathsObject = {}
  const webhooks: PathsObject = {}

  for (const definition of definitions) {
    if (definition.type === 'component') {
      const slot = (components[definition.componentType] ??= {}) as Record<string, object>
      slot[definition.name] = definition.component
    } else if (definition.type === 'route') {
      addOperation(paths, definition.route, builder)
    } else if (definition.type === 'webhook') {
      addOperation(webhooks, definition.webhook, builder)
    }
  }

  if (Object.keys(builder.schemas).length > 0) {
    components.schemas = { ...builder.schemas, ...components.schemas }
  }

  return {
    ...config,
    paths,
    // `webhooks` only exists from OpenAPI 3.1 on.
    ...(version === '3.1' && Object.keys(webhooks).length > 0 ? { webhooks } : {}),
    ...(Object.keys(components).length > 0 ? { components } : {}),
  }
}

const addOperation = (paths: PathsObject, route: RouteConfig, builder: DocumentBuilder): void => {
  // Whatever is not consumed here is an OpenAPI operation field, copied through as-is.
  const { method, path, request, responses, middleware, hide, ...rest } = route
  const operation: OperationObject = { ...rest, responses: responsesOf(responses, builder) }

  // A request describes what the client sends, so its schemas are read as input.
  const parameters = PARAMETER_SOURCES.flatMap(([key, location]) =>
    toArray(request?.[key]).flatMap((schema) => builder.parameters(schema, 'input', location))
  )
  if (parameters.length > 0) {
    operation.parameters = parameters
  }

  if (request?.body) {
    const { content, ...body } = request.body
    operation.requestBody = { ...body, content: builder.content(content, 'input') }
  }

  const pathItem = (paths[path] ??= {})
  pathItem[method] = operation
}

const responsesOf = (
  configs: RouteConfig['responses'],
  builder: DocumentBuilder
): ResponsesObject => {
  const responses: ResponsesObject = {}

  for (const [status, config] of Object.entries(configs)) {
    const response: ResponseObject = { description: config.description }

    if (config.headers) {
      response.headers = isStandardJSONSchema(config.headers)
        ? builder.headers(config.headers, 'output')
        : config.headers
    }
    if (config.links) {
      response.links = config.links
    }
    // A response describes what the server sends, so its schemas are read as output.
    if (config.content) {
      response.content = builder.content(config.content, 'output')
    }

    responses[status] = response
  }

  return responses
}

type SplitProperty = {
  name: string
  required: boolean
  description?: string
  schema: SchemaObject
}

/**
 * Converts schemas for one document, collecting reusable pieces into `components.schemas` —
 * both the names the user registered and any `$defs` the schema libraries emit.
 */
class DocumentBuilder {
  readonly schemas: Record<string, JSONSchema> = {}
  /** Component name -> a stable key for the schema as emitted, before its `$ref`s were rewritten. */
  readonly #sources = new Map<string, string>()
  readonly #named = new Map<StandardOpenAPISchema, Record<SchemaKind, string>>()

  constructor(private readonly targets: JSONSchemaTarget[]) {}

  /** A schema whose input and output differ needs two components; otherwise one is enough. */
  name(name: string, schema: StandardOpenAPISchema): void {
    const output = this.#convert(schema, 'output')
    const input = this.#convert(schema, 'input')
    const outputKey = stableStringify(output)
    const inputKey = stableStringify(input)

    const outputName = this.#nameFor(name, output, outputKey)
    const inputName =
      inputKey === outputKey ? outputName : this.#nameFor(`${name}Input`, input, inputKey)

    this.#named.set(schema, { input: inputName, output: outputName })
  }

  schema(schema: RouteSchema, kind: SchemaKind): SchemaObject | ReferenceObject {
    if (!isStandardJSONSchema(schema)) {
      return schema
    }

    const named = this.#named.get(schema)
    if (named) {
      return { $ref: `#/components/schemas/${named[kind]}` }
    }

    return this.#convert(schema, kind) as SchemaObject
  }

  content(content: ContentObject, kind: SchemaKind): OASContentObject {
    return Object.fromEntries(
      Object.entries(content).flatMap(([mediaType, media]) =>
        media ? [[mediaType, { ...media, schema: this.schema(media.schema, kind) }]] : []
      )
    ) as OASContentObject
  }

  /** Splits an object schema into one parameter per property, keeping optionality. */
  parameters(
    schema: StandardOpenAPISchema,
    kind: SchemaKind,
    location: ParameterLocation
  ): ParameterObject[] {
    return this.#split(schema, kind).map(({ name, ...rest }) => ({ in: location, name, ...rest }))
  }

  headers(schema: StandardOpenAPISchema, kind: SchemaKind): HeadersObject {
    return Object.fromEntries(this.#split(schema, kind).map(({ name, ...rest }) => [name, rest]))
  }

  /** One entry per property of an object schema, in the shape parameters and headers share. */
  #split(schema: StandardOpenAPISchema, kind: SchemaKind): SplitProperty[] {
    const converted = this.#convert(schema, kind)
    // Parameters and headers have nowhere to put a `$ref`, so read through a hoisted component.
    const hoisted = componentRefName(converted)
    const jsonSchema = hoisted ? (this.schemas[hoisted] ?? converted) : converted

    const properties = (jsonSchema.properties ?? {}) as Record<string, JSONSchema>
    const required = new Set((jsonSchema.required ?? []) as string[])

    return Object.entries(properties).map(([name, property]) => ({
      name,
      required: required.has(name),
      ...(typeof property.description === 'string' ? { description: property.description } : {}),
      schema: property as SchemaObject,
    }))
  }

  #convert(schema: StandardOpenAPISchema, kind: SchemaKind): JSONSchema {
    return this.#hoistDefs(toJSONSchema(schema, kind, this.targets))
  }

  /** Moves emitted `$defs` into `components.schemas` and repoints the `$ref`s at them. */
  #hoistDefs(root: JSONSchema): JSONSchema {
    const { $defs, definitions, ...rest } = root
    const defs = {
      ...(definitions as Record<string, JSONSchema> | undefined),
      ...($defs as Record<string, JSONSchema> | undefined),
    }
    const entries = Object.entries(defs)
    if (entries.length === 0) {
      return rest
    }

    // Reserve names before rewriting: a def may reference another def, including itself.
    const names = new Map(
      entries.map(([key, def]) => [key, this.#reserve(key, stableStringify(def))])
    )

    const rewrite = (value: unknown): unknown => {
      if (Array.isArray(value)) {
        return value.map(rewrite)
      }
      if (value === null || typeof value !== 'object') {
        return value
      }
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, child]) => {
          const pointer =
            key === '$ref' && typeof child === 'string' ? defPointerKey(child) : undefined
          const target = pointer === undefined ? undefined : names.get(pointer)
          return target ? [key, `#/components/schemas/${target}`] : [key, rewrite(child)]
        })
      )
    }

    for (const [key, def] of entries) {
      const name = names.get(key)
      if (name) {
        this.schemas[name] = rewrite(def) as JSONSchema
      }
    }

    return rewrite(rest) as JSONSchema
  }

  /** `preferred`, or `preferred` with a counter once a different schema has taken it. */
  #reserve(preferred: string, key: string): string {
    let candidate = preferred
    for (let n = 2; ; n++) {
      const existing = this.#sources.get(candidate)
      if (existing === undefined || existing === key) {
        this.#sources.set(candidate, key)
        return candidate
      }
      candidate = `${preferred}${n}`
    }
  }

  #nameFor(preferred: string, converted: JSONSchema, key: string): string {
    // `#hoistDefs` may have hoisted the whole schema already — reuse that component.
    const hoisted = componentRefName(converted)
    if (hoisted) {
      return hoisted
    }
    const name = this.#reserve(preferred, key)
    this.schemas[name] = converted
    return name
  }
}

/** The key a `#/$defs/Name` or `#/definitions/Name` pointer refers to, if it is one. */
const defPointerKey = (ref: string): string | undefined => {
  for (const prefix of ['#/$defs/', '#/definitions/']) {
    if (ref.startsWith(prefix)) {
      return decodeURIComponent(ref.slice(prefix.length))
        .replaceAll('~1', '/')
        .replaceAll('~0', '~')
    }
  }
  return undefined
}

const componentRefName = (jsonSchema: JSONSchema): string | undefined => {
  const ref = jsonSchema.$ref
  const prefix = '#/components/schemas/'
  return typeof ref === 'string' && ref.startsWith(prefix) ? ref.slice(prefix.length) : undefined
}
