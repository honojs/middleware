/**
 * OpenAPI 3.0 / 3.1 / 3.2 object model, defined from the specification itself.
 * Short names (`Schema`, `PathItem`, ...), `readonly` everywhere, `$ref` carried by `Reference` / `Schema` themselves. The shapes are a
 * superset of the three versions so one document type covers every output the generator emits.
 *
 * @see https://spec.openapis.org/oas/v3.2.0.html
 * @see https://json-schema.org/
 */
export type OpenAPI = {
  readonly openapi: string
  readonly $self?: string
  readonly info: Info
  readonly jsonSchemaDialect?: string
  readonly servers?: readonly Server[]
  readonly paths?: Paths
  readonly webhooks?: {
    readonly [k: string]: PathItem | Reference
  }
  readonly components?: Components
  readonly security?: readonly SecurityRequirement[]
  readonly tags?: readonly Tag[]
  readonly externalDocs?: ExternalDocs
}

export type Info = {
  readonly title: string
  readonly summary?: string
  readonly description?: string
  readonly termsOfService?: string
  readonly contact?: {
    readonly name?: string
    readonly url?: string
    readonly email?: string
  }
  readonly license?: {
    readonly name: string
    readonly identifier?: string
    readonly url?: string
  }
  readonly version: string
}

export type Tag = {
  readonly name: string
  readonly summary?: string
  readonly description?: string
  readonly externalDocs?: ExternalDocs
  readonly parent?: string
  readonly kind?: string
}

export type Paths = {
  readonly [k: string]: PathItem
}

export type Components = {
  readonly schemas?: {
    readonly [k: string]: Schema
  }
  readonly responses?: {
    readonly [k: string]: Responses
  }
  readonly parameters?: {
    readonly [k: string]: Parameter | Reference
  }
  readonly examples?: {
    readonly [k: string]: Example | Reference
  }
  readonly requestBodies?: {
    readonly [k: string]: RequestBody | Reference
  }
  readonly headers?: {
    readonly [k: string]: Header | Reference
  }
  readonly securitySchemes?: {
    readonly [k: string]: SecurityScheme | Reference
  }
  readonly links?: {
    readonly [k: string]: Link | Reference
  }
  readonly callbacks?: {
    readonly [k: string]: Callbacks | Reference
  }
  readonly pathItems?: {
    readonly [k: string]: PathItem | Reference
  }
  readonly mediaTypes?: {
    readonly [k: string]: Media | Reference
  }
}

export type SecurityScheme = {
  readonly type: 'apiKey' | 'http' | 'mutualTLS' | 'oauth2' | 'openIdConnect'
  readonly description?: string
  readonly name?: string
  readonly in?: 'query' | 'header' | 'cookie'
  readonly scheme?: string
  readonly bearerFormat?: string
  readonly flows?: OAuthFlow
  readonly openIdConnectUrl?: string
  readonly oauth2MetadataUrl?: string
  readonly deprecated?: boolean
}

type OAuthFlowDetail = {
  readonly authorizationUrl?: string
  readonly deviceAuthorizationUrl?: string
  readonly tokenUrl?: string
  readonly refreshUrl?: string
  readonly scopes: {
    readonly [k: string]: string
  }
}

type OAuthFlow = {
  readonly implicit?: OAuthFlowDetail
  readonly password?: OAuthFlowDetail
  readonly clientCredentials?: OAuthFlowDetail
  readonly authorizationCode?: OAuthFlowDetail
  readonly deviceAuthorization?: OAuthFlowDetail
}

export type SecurityRequirement = {
  readonly [scheme: string]: readonly string[]
}

export type Type = 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object' | 'null'

/**
 * Formats the generator emits plus the OpenAPI format registry
 * (https://spec.openapis.org/registry/format/). Any other string is accepted through
 * `openapi({ format })` because the registry is open.
 */
export type Format =
  | 'uuid'
  | 'email'
  | 'idn-email'
  | 'uri'
  | 'uri-reference'
  | 'iri'
  | 'iri-reference'
  | 'hostname'
  | 'idn-hostname'
  | 'ipv4'
  | 'ipv6'
  | 'ip'
  | 'date'
  | 'time'
  | 'date-time'
  | 'duration'
  | 'regex'
  | 'json-pointer'
  | 'relative-json-pointer'
  | 'uri-template'
  | 'byte'
  | 'binary'
  | 'password'
  | 'decimal'
  | 'decimal128'
  | 'int8'
  | 'uint8'
  | 'int16'
  | 'int32'
  | 'int64'
  | 'float'
  | 'double'
  | 'cuid2'
  | 'ulid'
  | 'nanoid'
  | 'emoji'
  | (string & {})

export type Ref =
  | `#/components/schemas/${string}`
  | `#/components/responses/${string}`
  | `#/components/parameters/${string}`
  | `#/components/examples/${string}`
  | `#/components/requestBodies/${string}`
  | `#/components/headers/${string}`
  | `#/components/securitySchemes/${string}`
  | `#/components/links/${string}`
  | `#/components/callbacks/${string}`
  | `#/components/pathItems/${string}`
  | `#/components/mediaTypes/${string}`

export type Reference = {
  readonly $ref: Ref
  readonly summary?: string
  readonly description?: string
}

export type Server = {
  readonly url: string
  readonly description?: string
  readonly name?: string
  readonly variables?: {
    readonly [k: string]: {
      readonly enum?: readonly string[]
      readonly default: string
      readonly description?: string
    }
  }
}

export type Example = {
  readonly summary?: string
  readonly description?: string
  readonly dataValue?: unknown
  readonly serializedValue?: string
  readonly externalValue?: string
  readonly value?: unknown
}

export type Examples = {
  readonly [k: string]: Example | Reference
}

export type Header = {
  readonly description?: string
  readonly required?: boolean
  readonly deprecated?: boolean
  readonly example?: unknown
  readonly examples?: Examples
  readonly style?: string
  readonly explode?: boolean
  readonly allowReserved?: boolean
  readonly schema?: Schema
  readonly content?: Content
}

export type Link = {
  readonly operationRef?: string
  readonly operationId?: string
  readonly parameters?: {
    readonly [k: string]: unknown
  }
  readonly requestBody?: unknown
  readonly description?: string
  readonly server?: Server
}

export type Encoding = {
  readonly contentType?: string
  readonly headers?: {
    readonly [k: string]: Header | Reference
  }
  readonly style?: string
  readonly explode?: boolean
  readonly allowReserved?: boolean
  readonly encoding?: {
    readonly [k: string]: Encoding
  }
  readonly prefixEncoding?: readonly Encoding[]
  readonly itemEncoding?: Encoding
}

export type Media = {
  readonly schema?: Schema
  readonly itemSchema?: Schema
  readonly example?: unknown
  readonly examples?: Examples
  readonly encoding?: {
    readonly [k: string]: Encoding
  }
  readonly prefixEncoding?: readonly Encoding[]
  readonly itemEncoding?: Encoding
}

export type Content = {
  readonly [k: string]: Media | Reference
}

export type PathItem = {
  readonly $ref?: Ref
  readonly summary?: string
  readonly description?: string
  readonly get?: Operation
  readonly put?: Operation
  readonly post?: Operation
  readonly delete?: Operation
  readonly options?: Operation
  readonly head?: Operation
  readonly patch?: Operation
  readonly trace?: Operation
  readonly query?: Operation
  readonly additionalOperations?: {
    readonly [k: string]: Operation
  }
  readonly servers?: readonly Server[]
  readonly parameters?: readonly (Parameter | Reference)[]
}

export type Operation = {
  readonly tags?: readonly string[]
  readonly summary?: string
  readonly description?: string
  readonly externalDocs?: ExternalDocs
  readonly operationId?: string
  readonly parameters?: readonly (Parameter | Reference)[]
  readonly requestBody?: RequestBody | Reference
  readonly responses?: {
    readonly [k: string]: Responses
  }
  readonly callbacks?: {
    readonly [k: string]: Callbacks | Reference
  }
  readonly deprecated?: boolean
  readonly security?: readonly SecurityRequirement[]
  readonly servers?: readonly Server[]
}

export type Responses = {
  readonly $ref?: Ref
  readonly summary?: string
  readonly description?: string
  readonly content?: Content
  readonly headers?: {
    readonly [k: string]: Header | Reference
  }
  readonly links?: {
    readonly [k: string]: Link | Reference
  }
}

export type Discriminator = {
  readonly propertyName: string
  readonly mapping?: {
    readonly [k: string]: string
  }
  readonly defaultMapping?: string
}

export type ExternalDocs = {
  readonly url: string
  readonly description?: string
}

export type Schema = {
  readonly $ref?: Ref
  readonly $schema?: string
  readonly $id?: string
  readonly $anchor?: string
  readonly $comment?: string
  readonly $defs?: { readonly [k: string]: Schema }
  readonly discriminator?: Discriminator
  readonly xml?: {
    readonly nodeType?: string
    readonly name?: string
    readonly namespace?: string
    readonly prefix?: string
    readonly attribute?: boolean
    readonly wrapped?: boolean
  }
  readonly externalDocs?: ExternalDocs
  readonly example?: unknown
  readonly examples?: readonly unknown[]
  readonly title?: string
  readonly description?: string
  readonly type?: Type | readonly Type[]
  readonly format?: Format
  readonly pattern?: string
  readonly minLength?: number
  readonly maxLength?: number
  readonly minimum?: number
  readonly maximum?: number
  /** boolean in OpenAPI 3.0, number in 3.1+ (JSON Schema 2020-12) */
  readonly exclusiveMinimum?: number | boolean
  readonly exclusiveMaximum?: number | boolean
  readonly multipleOf?: number
  readonly minItems?: number
  readonly maxItems?: number
  readonly uniqueItems?: boolean
  readonly minProperties?: number
  readonly maxProperties?: number
  readonly default?: unknown
  readonly properties?: {
    readonly [k: string]: Schema
  }
  readonly required?: readonly string[]
  readonly items?: Schema | readonly Schema[] | boolean
  readonly prefixItems?: readonly Schema[]
  readonly enum?: readonly unknown[]
  /** OpenAPI 3.0 only; 3.1+ uses `type: [..., 'null']` */
  readonly nullable?: boolean
  readonly readOnly?: boolean
  readonly writeOnly?: boolean
  readonly deprecated?: boolean
  readonly additionalProperties?: Schema | boolean
  readonly oneOf?: readonly Schema[]
  readonly allOf?: readonly Schema[]
  readonly anyOf?: readonly Schema[]
  readonly not?: Schema
  readonly const?: unknown
  readonly patternProperties?: {
    readonly [k: string]: Schema
  }
  readonly propertyNames?: Schema
  readonly dependentRequired?: {
    readonly [k: string]: readonly string[]
  }
  readonly dependentSchemas?: { readonly [k: string]: Schema }
  readonly contains?: Schema
  readonly minContains?: number
  readonly maxContains?: number
  readonly contentEncoding?: string
  readonly contentMediaType?: string
  readonly contentSchema?: Schema
  readonly if?: Schema
  readonly then?: Schema
  readonly else?: Schema
  readonly unevaluatedProperties?: boolean | Schema
  readonly unevaluatedItems?: boolean | Schema
}

export type Parameter = {
  readonly name: string
  readonly in: 'path' | 'query' | 'header' | 'cookie' | 'querystring'
  readonly description?: string
  readonly required?: boolean
  readonly deprecated?: boolean
  readonly allowEmptyValue?: boolean
  readonly style?: string
  readonly explode?: boolean
  readonly allowReserved?: boolean
  readonly schema?: Schema
  readonly content?: Content
  readonly example?: unknown
  readonly examples?: Examples
}

export type RequestBody = {
  readonly description?: string
  readonly content: Content
  readonly required?: boolean
}

export type Callbacks = {
  readonly [k: string]: PathItem | Reference
}
