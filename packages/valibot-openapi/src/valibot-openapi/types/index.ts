import type { GenericSchema } from 'valibot'

import type { ValibotToOpenAPIError } from '../errors/index'
import type {
  Callbacks,
  Discriminator,
  Encoding,
  Example,
  Examples,
  Header,
  Link,
  Media,
  OpenAPI,
  Operation,
  Parameter,
  PathItem,
  Reference,
  RequestBody,
  Responses,
  Schema,
  SecurityScheme,
  Type,
} from '../openapi/index'

// The object model lives in `openapi/index.ts` (short names: `Schema`, `PathItem`, ...).
// The generator code uses the `*Object` spelling of the specification, so they are aliased here.
export type ReferenceObject = Reference
export type SchemaObject = Schema
export type SchemaObjectType = Type
export type ParameterObject = Parameter
export type MediaTypeObject = Media
export type ResponseObject = Responses
export type HeadersObject = { readonly [k: string]: Header | Reference }
export type PathItemObject = PathItem
export type OpenAPIObject = OpenAPI
export type DiscriminatorObject = Discriminator
export type ParameterLocation = Exclude<Parameter['in'], 'querystring'>

export type NullableType = {
  readonly type?: SchemaObjectType | readonly SchemaObjectType[]
  readonly nullable?: boolean
}

export type MapNullableType = (
  type: SchemaObjectType | readonly SchemaObjectType[] | undefined
) => NullableType

export type MapNullableRef = (
  ref: ReferenceObject
) =>
  | ReferenceObject
  | { oneOf: (ReferenceObject | { type: 'null' })[] }
  | { allOf: (ReferenceObject | { nullable: boolean })[] }

export type MapNullableOfArray = (
  objects: (SchemaObject | ReferenceObject)[]
) => (SchemaObject | ReferenceObject)[]

export type MapSubSchema = (
  schema: GenericSchema
) =>
  | { readonly ok: true; readonly value: SchemaObject | ReferenceObject }
  | { readonly ok: false; readonly error: ValibotToOpenAPIError }

// 3.0 uses boolean `exclusiveMinimum` / `exclusiveMaximum`, 3.1+ uses numbers.
export type NumberBounds = {
  readonly minimum?: number
  readonly maximum?: number
  readonly exclusiveMinimum?: number | boolean
  readonly exclusiveMaximum?: number | boolean
}

export type NumberCheck =
  | { readonly kind: 'min_value'; readonly value: number }
  | { readonly kind: 'max_value'; readonly value: number }
  | { readonly kind: 'gt_value'; readonly value: number }
  | { readonly kind: 'lt_value'; readonly value: number }

export type UnionPreferredType = 'oneOf' | 'anyOf'

export type OpenApiOptions = {
  readonly unionPreferredType?: UnionPreferredType
}

type ExampleValue<T> = T extends Date ? string : T

/**
 * SchemaObject keywords that can be attached through `openapi()`. `exclusiveMinimum` /
 * `exclusiveMaximum` follow the 3.1+ numeric form.
 */
export type SchemaMetadata = {
  readonly [extension: `x-${string}`]: unknown
  readonly type?: SchemaObjectType | readonly SchemaObjectType[]
  readonly format?: string
  readonly title?: string
  readonly description?: string
  readonly deprecated?: boolean
  readonly nullable?: boolean
  readonly readOnly?: boolean
  readonly writeOnly?: boolean
  readonly minimum?: number
  readonly maximum?: number
  readonly exclusiveMinimum?: number
  readonly exclusiveMaximum?: number
  readonly multipleOf?: number
  readonly minLength?: number
  readonly maxLength?: number
  readonly pattern?: string
  readonly minItems?: number
  readonly maxItems?: number
  readonly uniqueItems?: boolean
  readonly minProperties?: number
  readonly maxProperties?: number
  readonly required?: string[]
  readonly enum?: unknown[]
  readonly const?: unknown
  readonly items?: SchemaObject | ReferenceObject
  readonly prefixItems?: (SchemaObject | ReferenceObject)[]
  readonly properties?: { [propertyName: string]: SchemaObject | ReferenceObject }
  readonly additionalProperties?: SchemaObject | ReferenceObject | boolean
  readonly allOf?: (SchemaObject | ReferenceObject)[]
  readonly oneOf?: (SchemaObject | ReferenceObject)[]
  readonly anyOf?: (SchemaObject | ReferenceObject)[]
  readonly not?: SchemaObject | ReferenceObject
  readonly discriminator?: DiscriminatorObject
  readonly xml?: SchemaObject['xml']
  readonly externalDocs?: SchemaObject['externalDocs']
  readonly contentMediaType?: string
  readonly contentEncoding?: string
}

export type ParameterMetadata = Partial<
  Omit<ParameterObject, 'in' | 'schema' | 'example' | 'examples'>
> & {
  readonly in?: ParameterLocation
  readonly schema?: SchemaObject | ReferenceObject
  readonly examples?: ParameterObject['examples']
}

export type OpenAPIMetadata<T = unknown, E = ExampleValue<T>> = SchemaMetadata & {
  readonly param?: ParameterMetadata & { readonly example?: E }
  readonly example?: E
  readonly examples?: E[]
  readonly default?: T
}

export type InternalMetadata = OpenApiOptions & {
  readonly refId?: string
}

export type FullMetadata = OpenAPIMetadata & {
  readonly [k: string]: unknown
}

export type VersionSpecifics = {
  readonly nullType: SchemaObject
  readonly mapNullableOfArray: (
    objects: (SchemaObject | ReferenceObject)[],
    isNullable: boolean
  ) => (SchemaObject | ReferenceObject)[]
  readonly mapNullableType: (
    type: SchemaObjectType | readonly SchemaObjectType[] | undefined,
    isNullable: boolean
  ) => NullableType
  readonly mapNullableOfRef: (
    ref: ReferenceObject,
    isNullable: boolean
  ) =>
    | ReferenceObject
    | { allOf: (ReferenceObject | { nullable: boolean })[] }
    | { oneOf: (ReferenceObject | { type: 'null' })[] }
  readonly mapTupleItems: (
    schemas: (SchemaObject | ReferenceObject)[],
    rest: SchemaObject | ReferenceObject | undefined
  ) => {
    items?: SchemaObject | ReferenceObject
    minItems?: number
    maxItems?: number
    prefixItems?: (SchemaObject | ReferenceObject)[]
  }
  readonly getNumberChecks: (checks: readonly NumberCheck[]) => NumberBounds
}

export type GeneratorOptions = {
  readonly unionPreferredType?: UnionPreferredType
  readonly sortComponents?: 'alphabetically'
}

export type SchemaRefValue = SchemaObject | ReferenceObject | 'pending'

// Registry input types. Raw component objects are owned by the caller and passed through
// untouched, so they are typed with the 3.2 model (a superset of 3.0 / 3.1).
export type ComponentTypeMap = {
  schemas: Schema
  responses: Responses
  parameters: Parameter | Reference
  examples: Example | Reference
  requestBodies: RequestBody | Reference
  headers: Header | Reference
  securitySchemes: SecurityScheme | Reference
  links: Link | Reference
  callbacks: Callbacks | Reference
  /** @since OAS 3.1 */
  pathItems: PathItem | Reference
  /** @since OAS 3.2 */
  mediaTypes: Media | Reference
}

export type ComponentTypeKey = keyof ComponentTypeMap
export type ComponentTypeOf<K extends ComponentTypeKey> = ComponentTypeMap[K]
export type OpenAPIComponentObject = ComponentTypeMap[ComponentTypeKey]

export type Method =
  | 'get'
  | 'post'
  | 'put'
  | 'delete'
  | 'patch'
  | 'head'
  | 'options'
  | 'trace'
  /** @since OAS 3.2 */
  | 'query'

export type MediaTypeConfig = {
  readonly schema?: GenericSchema | SchemaObject | ReferenceObject
  readonly examples?: Examples
  readonly example?: unknown
  readonly encoding?: { readonly [k: string]: Encoding }
  /**
   * @since OAS 3.2 Schema for the items of a sequential media type such as
   * `text/event-stream`, `application/jsonl` or `application/json-seq`.
   */
  readonly itemSchema?: GenericSchema | SchemaObject | ReferenceObject
  /** @since OAS 3.2 Positional encoding applied to a tuple/array body. */
  readonly prefixEncoding?: readonly Encoding[]
  /** @since OAS 3.2 Encoding applied to each item of a sequential body. */
  readonly itemEncoding?: Encoding
}

export type MediaType =
  'application/json' | 'text/html' | 'text/plain' | 'application/xml' | (string & {})

export type ContentConfig = Partial<Record<MediaType, MediaTypeConfig | ReferenceObject>>

export type RequestBodyConfig = {
  readonly description?: string
  readonly content: ContentConfig
  readonly required?: boolean
}

export type ResponseConfig = {
  // `description` is optional since OAS 3.2 (it remains required in 3.0/3.1).
  readonly description?: string
  /** @since OAS 3.2 */
  readonly summary?: string
  readonly headers?: GenericSchema | HeadersObject
  readonly links?: { readonly [k: string]: Link | Reference }
  readonly content?: ContentConfig
}

export type RouteParameter = GenericSchema | undefined

export type RouteConfig = Omit<Operation, 'responses'> & {
  readonly method: Method
  readonly path: string
  readonly request?: {
    readonly body?: RequestBodyConfig
    readonly params?: RouteParameter
    readonly query?: RouteParameter
    readonly cookies?: RouteParameter
    readonly headers?: RouteParameter | readonly GenericSchema[]
  }
  readonly responses: {
    readonly [statusCode: string]: ResponseConfig | ReferenceObject
  }
}

export type WebhookDefinition = { readonly type: 'webhook'; readonly webhook: RouteConfig }

export type OpenAPIDefinition =
  | {
      readonly type: 'component'
      readonly componentType: ComponentTypeKey
      readonly name: string
      readonly component: OpenAPIComponentObject
    }
  | { readonly type: 'schema'; readonly schema: GenericSchema }
  | { readonly type: 'parameter'; readonly schema: GenericSchema }
  | { readonly type: 'route'; readonly route: RouteConfig }
  | WebhookDefinition

export type Definition = OpenAPIDefinition | GenericSchema

export type RawComponent = {
  readonly componentType: ComponentTypeKey
  readonly name: string
  readonly component: OpenAPIComponentObject
}

/**
 * Mutable state of one document generation. The maps are the only place the generator keeps
 * state: every other function is a pure function of its inputs and this context.
 */
export type GenerationContext = {
  readonly specifics: VersionSpecifics
  readonly options: GeneratorOptions | undefined
  readonly schemaRefs: Map<string, SchemaRefValue>
  readonly paramRefs: Map<string, ParameterObject>
  readonly pathRefs: Map<string, PathItemObject>
  readonly webhookRefs: Map<string, PathItemObject>
  readonly rawComponents: RawComponent[]
}

export type OpenApiVersion =
  '3.0.0' | '3.0.1' | '3.0.2' | '3.0.3' | '3.0.4' | '3.1.0' | '3.1.1' | '3.2.0'
