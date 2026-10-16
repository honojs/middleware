import type { H } from 'hono/types'
import type {
  HeadersObject,
  MediaTypeObject as OASMediaTypeObject,
  OperationObject,
  ReferenceObject,
  RequestBodyObject,
  ResponseObject,
  SchemaObject,
} from 'openapi3-ts/oas31'
import type { StandardOpenAPISchema } from './standard-schema'

export type Method = 'get' | 'post' | 'put' | 'delete' | 'patch' | 'head' | 'options' | 'trace'

/** A Standard JSON Schema from any library, or a JSON Schema object passed through untouched. */
export type RouteSchema = StandardOpenAPISchema | SchemaObject | ReferenceObject

export type MediaTypeObject = Omit<OASMediaTypeObject, 'schema'> & { schema: RouteSchema }

export type ContentObject = Partial<Record<string, MediaTypeObject>>

export type RequestBody = Omit<RequestBodyObject, 'content'> & { content: ContentObject }

export type ResponseConfig = Omit<ResponseObject, 'content' | 'headers'> & {
  /** An object schema, split into one header each, or a literal OpenAPI headers object. */
  headers?: StandardOpenAPISchema | HeadersObject
  content?: ContentObject
}

export type RouteConfig = Omit<
  OperationObject,
  'parameters' | 'requestBody' | 'responses' | 'callbacks'
> & {
  method: Method
  path: string
  request?: {
    body?: RequestBody
    params?: StandardOpenAPISchema
    query?: StandardOpenAPISchema
    cookies?: StandardOpenAPISchema
    /**
     * One object schema, or several. Each is documented and validated, but Hono keeps a single
     * `header` target, so `c.req.valid('header')` is typed only when one schema is given.
     */
    headers?: StandardOpenAPISchema | StandardOpenAPISchema[]
  }
  responses: {
    [statusCode: string]: ResponseConfig
  }
  middleware?: H | H[]
  hide?: boolean
}
