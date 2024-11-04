import type { TObject, TSchema } from '@sinclair/typebox'
import type { MiddlewareHandler } from 'hono/types'
import type { OpenAPIV3_1 } from 'openapi-types'

export type HTTPMethod = 'get' | 'post' | 'put' | 'delete' | 'patch' | 'head' | 'options' | 'trace'

export type ContentType =
  | (string & {})
  | 'text/plain'
  | 'text/html'
  | 'application/xml'
  | 'application/json'
  | 'multipart/form-data'
  | 'application/x-www-form-urlencoded'

export type OpenAPIRoute<
  TBody extends TSchema = TSchema,
  THeaders extends TSchema = TSchema,
  TQuery extends TSchema = TSchema,
  TParams extends TSchema = TSchema,
  TCookie extends TSchema = TSchema,
  TResponses extends Record<string, TSchema> = Record<string, TSchema>
> = {
  path: string
  method: HTTPMethod
  request: RequestTypes<TBody, THeaders, TQuery, TParams, TCookie>
  responses: ResponsesObject<TResponses>
  middleware?: MiddlewareHandler | MiddlewareHandler[]
} & { detail?: DocumentDecoration }

export type DocumentDecoration = Partial<
  Omit<OpenAPIV3_1.OperationObject, 'parameters' | 'responses' | 'requestBody'>
> & {
  /**
   * Pass `true` to hide route from OpenAPI document
   * */
  hide?: boolean
}

export type RequestTypes<
  TBody extends TSchema = TSchema,
  THeaders extends TSchema = TSchema,
  TQuery extends TSchema = TSchema,
  TParams extends TSchema = TSchema,
  TCookie extends TSchema = TSchema
> = {
  body?: RequestBodyObject<TBody>
  headers?: THeaders
  query?: TQuery
  params?: TParams
  cookies?: TCookie
}

export type RequestBodyObject<TBody extends TSchema = TSchema> = Omit<
  OpenAPIV3_1.RequestBodyObject,
  'content' | 'required'
> & {
  content: ContentObject<TBody>
}

export type ContentObject<TContent extends TSchema = TSchema> = Partial<
  Record<ContentType, ContentTypeObject<TContent>>
>

export type ContentTypeObject<TContent extends TSchema = TSchema> = Pick<
  OpenAPIV3_1.MediaTypeObject,
  'encoding'
> & {
  schema: TContent
}

export type ResponsesObject<T extends Record<string, TSchema> = Record<string, TSchema>> = {
  [K in keyof T]: ResponseConfig<T[K]>
}

export type ResponseConfig<TResp extends TSchema = TSchema> =
  | {
      description: string
      headers?: TObject | OpenAPIV3_1.ResponseObject['headers']
      links?: OpenAPIV3_1.ResponseObject['links']
    }
  | {
      description: string
      content: ContentObject<TResp>
      headers?: TObject | OpenAPIV3_1.ResponseObject['headers']
      links?: OpenAPIV3_1.ResponseObject['links']
    }

export type OpenAPIDocsConfig = {
  documentation: Omit<
    Partial<OpenAPIV3_1.Document>,
    | 'openapi'
    | 'paths'
    | 'components'
    | 'webhooks'
    | 'x-express-openapi-additional-middleware'
    | 'x-express-openapi-validation-strict'
  > &
    Required<Pick<OpenAPIV3_1.Document, 'info'>> & {
      /**
       * OpenAPI version
       */
      openapi: `3.1.${number}`

      /**
       * OpenAPI security
       */
      securitySchemes?: OpenAPIV3_1.ComponentsObject['securitySchemes']
    }

  /**
   * Exclude methods from OpenAPI
   */
  excludeMethods?: string[]

  /**
   * Exclude tags from OpenAPI
   */
  excludeTags?: string[]
}
