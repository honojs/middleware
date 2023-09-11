/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import type {
  ResponseConfig,
  RouteConfig,
  ZodContentObject,
  ZodRequestBody,
} from '@asteasolutions/zod-to-openapi'
import { OpenApiGeneratorV3, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi'
import type { OpenAPIObjectConfig } from '@asteasolutions/zod-to-openapi/dist/v3.0/openapi-generator'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import type {
  Context,
  Env,
  Handler,
  Input,
  MiddlewareHandler,
  Schema,
  ToSchema,
  TypedResponse,
} from 'hono'
import type { AnyZodObject, ZodSchema, ZodError } from 'zod'
import { z, ZodType } from 'zod'

type RequestTypes = {
  body?: ZodRequestBody
  params?: AnyZodObject
  query?: AnyZodObject
  cookies?: AnyZodObject
  headers?: AnyZodObject | ZodType<unknown>[]
}

type IsJson<T> = T extends string
  ? T extends `application/json${infer _Rest}`
    ? 'json'
    : never
  : never

type IsForm<T> = T extends string
  ? T extends
      | `multipart/form-data${infer _Rest}`
      | `application/x-www-form-urlencoded${infer _Rest}`
    ? 'form'
    : never
  : never

type RequestPart<R extends RouteConfig, Part extends string> = Part extends keyof R['request']
  ? R['request'][Part]
  : {}

type InputTypeBase<
  R extends RouteConfig,
  Part extends string,
  Type extends string
> = R['request'] extends RequestTypes
  ? RequestPart<R, Part> extends AnyZodObject
    ? {
        in: { [K in Type]: z.input<RequestPart<R, Part>> }
        out: { [K in Type]: z.input<RequestPart<R, Part>> }
      }
    : {}
  : {}

type InputTypeJson<R extends RouteConfig> = R['request'] extends RequestTypes
  ? R['request']['body'] extends ZodRequestBody
    ? R['request']['body']['content'] extends ZodContentObject
      ? IsJson<keyof R['request']['body']['content']> extends never
        ? {}
        : R['request']['body']['content'][keyof R['request']['body']['content']]['schema'] extends ZodSchema<any>
        ? {
            in: {
              json: z.input<
                R['request']['body']['content'][keyof R['request']['body']['content']]['schema']
              >
            }
            out: {
              json: z.input<
                R['request']['body']['content'][keyof R['request']['body']['content']]['schema']
              >
            }
          }
        : {}
      : {}
    : {}
  : {}

type InputTypeForm<R extends RouteConfig> = R['request'] extends RequestTypes
  ? R['request']['body'] extends ZodRequestBody
    ? R['request']['body']['content'] extends ZodContentObject
      ? IsForm<keyof R['request']['body']['content']> extends never
        ? {}
        : R['request']['body']['content'][keyof R['request']['body']['content']]['schema'] extends ZodSchema<any>
        ? {
            in: {
              form: z.input<
                R['request']['body']['content'][keyof R['request']['body']['content']]['schema']
              >
            }
            out: {
              form: z.input<
                R['request']['body']['content'][keyof R['request']['body']['content']]['schema']
              >
            }
          }
        : {}
      : {}
    : {}
  : {}

type InputTypeParam<R extends RouteConfig> = InputTypeBase<R, 'params', 'param'>
type InputTypeQuery<R extends RouteConfig> = InputTypeBase<R, 'query', 'query'>
type InputTypeHeader<R extends RouteConfig> = InputTypeBase<R, 'headers', 'header'>
type InputTypeCookie<R extends RouteConfig> = InputTypeBase<R, 'cookies', 'cookie'>

type OutputType<R extends RouteConfig> = R['responses'] extends Record<infer _, infer C>
  ? C extends ResponseConfig
    ? C['content'] extends ZodContentObject
      ? IsJson<keyof C['content']> extends never
        ? {}
        : C['content'][keyof C['content']]['schema'] extends ZodSchema
        ? z.infer<C['content'][keyof C['content']]['schema']>
        : {}
      : {}
    : {}
  : {}

type Hook<T, E extends Env, P extends string, O> = (
  result:
    | {
        success: true
        data: T
      }
    | {
        success: false
        error: ZodError
      },
  c: Context<E, P>
) => TypedResponse<O> | Promise<TypedResponse<T>> | void

type ConvertPathType<T extends string> = T extends `${infer _}/{${infer Param}}${infer _}`
  ? `/:${Param}`
  : T

type HandlerResponse<O> = TypedResponse<O> | Promise<TypedResponse<O>>

export class OpenAPIHono<
  E extends Env = Env,
  S extends Schema = {},
  BasePath extends string = '/'
> extends Hono<E, S, BasePath> {
  openAPIRegistry: OpenAPIRegistry

  constructor() {
    super()
    this.openAPIRegistry = new OpenAPIRegistry()
  }

  openapi = <
    R extends RouteConfig,
    I extends Input = InputTypeParam<R> &
      InputTypeQuery<R> &
      InputTypeHeader<R> &
      InputTypeCookie<R> &
      InputTypeForm<R> &
      InputTypeJson<R>,
    P extends string = ConvertPathType<R['path']>
  >(
    route: R,
    handler: Handler<E, P, I, HandlerResponse<OutputType<R>>>,
    hook?: Hook<I, E, P, OutputType<R>>
  ): Hono<E, ToSchema<R['method'], P, I['in'], OutputType<R>>, BasePath> => {
    this.openAPIRegistry.registerPath(route)

    const validators: MiddlewareHandler[] = []

    if (route.request?.query) {
      const validator = zValidator('query', route.request.query as any, hook as any)
      validators.push(validator as any)
    }

    if (route.request?.params) {
      const validator = zValidator('param', route.request.params as any, hook as any)
      validators.push(validator as any)
    }

    if (route.request?.headers) {
      const validator = zValidator('header', route.request.headers as any, hook as any)
      validators.push(validator as any)
    }

    if (route.request?.cookies) {
      const validator = zValidator('cookie', route.request.cookies as any, hook as any)
      validators.push(validator as any)
    }

    const bodyContent = route.request?.body?.content

    if (bodyContent) {
      for (const mediaType of Object.keys(bodyContent)) {
        if (mediaType.startsWith('application/json')) {
          const schema = bodyContent[mediaType]['schema']
          if (schema instanceof ZodType) {
            const validator = zValidator('json', schema as any, hook as any)
            validators.push(validator as any)
          }
        }
        if (
          mediaType.startsWith('multipart/form-data') ||
          mediaType.startsWith('application/x-www-form-urlencoded')
        ) {
          const schema = bodyContent[mediaType]['schema']
          if (schema instanceof ZodType) {
            const validator = zValidator('form', schema as any, hook as any)
            validators.push(validator as any)
          }
        }
      }
    }

    this.on([route.method], route.path.replaceAll(/\/{(.+?)}/g, '/:$1'), ...validators, handler)
    return this
  }

  getOpenAPIDocument = (config: OpenAPIObjectConfig) => {
    const generator = new OpenApiGeneratorV3(this.openAPIRegistry.definitions)
    const document = generator.generateDocument(config)
    return document
  }

  doc = (path: string, config: OpenAPIObjectConfig) => {
    this.get(path, (c) => {
      const document = this.getOpenAPIDocument(config)
      return c.json(document)
    })
  }
}

export const createRoute = <P extends string, R extends Omit<RouteConfig, 'path'> & { path: P }>(
  routeConfig: R
) => routeConfig

extendZodWithOpenApi(z)
export { z }
