/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import type {
  ResponseConfig,
  RouteConfig,
  ZodContentObject,
  ZodRequestBody,
} from '@asteasolutions/zod-to-openapi'
import {
  OpenApiGeneratorV3,
  OpenApiGeneratorV31,
  OpenAPIRegistry,
} from '@asteasolutions/zod-to-openapi'
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
import type { MergePath, MergeSchemaPath } from 'hono/dist/types/types'
import type { RemoveBlankRecord } from 'hono/utils/types'
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
        out: { [K in Type]: z.output<RequestPart<R, Part>> }
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
              json: z.output<
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
              form: z.output<
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

type ConvertPathType<T extends string> = T extends `${infer Start}/{${infer Param}}${infer Rest}`
  ? `${Start}/:${Param}${ConvertPathType<Rest>}`
  : T

type HandlerResponse<O> = TypedResponse<O> | Promise<TypedResponse<O>>

export type OpenAPIHonoOptions<E extends Env> = {
  defaultHook?: Hook<any, E, any, any>
  strictStatusCode?: boolean
  strictResponse?: boolean
}
type HonoInit<E extends Env> = ConstructorParameters<typeof Hono>[0] & OpenAPIHonoOptions<E>

export type RouteHandler<
  R extends RouteConfig,
  E extends Env = Env,
  I extends Input = InputTypeParam<R> &
    InputTypeQuery<R> &
    InputTypeHeader<R> &
    InputTypeCookie<R> &
    InputTypeForm<R> &
    InputTypeJson<R>,
  P extends string = ConvertPathType<R['path']>
> = Handler<E, P, I, HandlerResponse<OutputType<R>>>

export type RouteHook<
  R extends RouteConfig,
  E extends Env = Env,
  I extends Input = InputTypeParam<R> &
    InputTypeQuery<R> &
    InputTypeHeader<R> &
    InputTypeCookie<R> &
    InputTypeForm<R> &
    InputTypeJson<R>,
  P extends string = ConvertPathType<R['path']>
> = Hook<I, E, P, OutputType<R>>

export class OpenAPIHono<
  E extends Env = Env,
  S extends Schema = {},
  BasePath extends string = '/'
> extends Hono<E, S, BasePath> {
  openAPIRegistry: OpenAPIRegistry
  defaultHook?: OpenAPIHonoOptions<E>['defaultHook']
  strictStatusCode?: OpenAPIHonoOptions<E>['strictStatusCode']
  strictResponse?: OpenAPIHonoOptions<E>['strictResponse']

  constructor(init?: HonoInit<E>) {
    super(init)
    this.openAPIRegistry = new OpenAPIRegistry()
    this.defaultHook = init?.defaultHook
    this.strictStatusCode = init?.strictStatusCode
    this.strictResponse = init?.strictResponse
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
    hook: Hook<I, E, P, OutputType<R>> | undefined = this.defaultHook
  ): OpenAPIHono<E, S & ToSchema<R['method'], P, I['in'], OutputType<R>>, BasePath> => {
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

    if (this.strictResponse) {
      const responseZodSchemaObject: Record<string, ZodType<any>> = {}
      for (const [statusCode, responseConfig] of Object.entries(route.responses)) {
        for (const mediaTypeObject of Object.values(responseConfig.content ?? {})) {
          if (mediaTypeObject.schema instanceof ZodType) {
            responseZodSchemaObject[statusCode] = mediaTypeObject.schema
          }
        }
      }

      if (Object.keys(responseZodSchemaObject).length > 0) {
        validators.push(async (c, next) => {
          await next()

          const schema = responseZodSchemaObject[c.res.status]
          if (schema) {
            const originalBody = await c.res.json()
            const result = await schema.safeParseAsync(originalBody)
            if (!result.success) {
              c.res = c.json(result.error, {
                status: 500,
              })
            } else {
              c.res = c.json(result.data)
            }
          }
        })
      }
    }

    if (this.strictStatusCode) {
      validators.push(async (c, next) => {
        await next()

        if (!route.responses[c.res.status]) {
          c.res = c.json(
            {
              success: false,
              error: 'Response code does not match any of the defined responses.',
            },
            {
              status: 500,
            }
          )
          return
        }
      })
    }

    this.on([route.method], route.path.replaceAll(/\/{(.+?)}/g, '/:$1'), ...validators, handler)
    return this
  }

  getOpenAPIDocument = (config: OpenAPIObjectConfig) => {
    const generator = new OpenApiGeneratorV3(this.openAPIRegistry.definitions)
    const document = generator.generateDocument(config)
    return document
  }

  getOpenAPI31Document = (config: OpenAPIObjectConfig) => {
    const generator = new OpenApiGeneratorV31(this.openAPIRegistry.definitions)
    const document = generator.generateDocument(config)
    return document
  }

  doc = (path: string, config: OpenAPIObjectConfig) => {
    this.get(path, (c) => {
      const document = this.getOpenAPIDocument(config)
      return c.json(document)
    })
  }

  doc31 = (path: string, config: OpenAPIObjectConfig) => {
    this.get(path, (c) => {
      const document = this.getOpenAPI31Document(config)
      return c.json(document)
    })
  }

  route<
    SubPath extends string,
    SubEnv extends Env,
    SubSchema extends Schema,
    SubBasePath extends string
  >(
    path: SubPath,
    app: Hono<SubEnv, SubSchema, SubBasePath>
  ): OpenAPIHono<E, MergeSchemaPath<SubSchema, MergePath<BasePath, SubPath>> & S, BasePath>
  route<SubPath extends string>(path: SubPath): Hono<E, RemoveBlankRecord<S>, BasePath>
  route<
    SubPath extends string,
    SubEnv extends Env,
    SubSchema extends Schema,
    SubBasePath extends string
  >(
    path: SubPath,
    app?: Hono<SubEnv, SubSchema, SubBasePath>
  ): OpenAPIHono<E, MergeSchemaPath<SubSchema, MergePath<BasePath, SubPath>> & S, BasePath> {
    super.route(path, app as any)

    if (!(app instanceof OpenAPIHono)) {
      return this as any
    }

    app.openAPIRegistry.definitions.forEach((def) => {
      switch (def.type) {
        case 'component':
          return this.openAPIRegistry.registerComponent(def.componentType, def.name, def.component)

        case 'route':
          return this.openAPIRegistry.registerPath({
            ...def.route,
            path: `${path}${def.route.path}`,
          })

        case 'webhook':
          return this.openAPIRegistry.registerWebhook({
            ...def.webhook,
            path: `${path}${def.webhook.path}`,
          })

        case 'schema':
          return this.openAPIRegistry.register(def.schema._def.openapi._internal.refId, def.schema)

        case 'parameter':
          return this.openAPIRegistry.registerParameter(
            def.schema._def.openapi._internal.refId,
            def.schema
          )

        default: {
          const errorIfNotExhaustive: never = def
          throw new Error(`Unknown registry type: ${errorIfNotExhaustive}`)
        }
      }
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this as any
  }

  basePath<SubPath extends string>(path: SubPath): OpenAPIHono<E, S, MergePath<BasePath, SubPath>> {
    return new OpenAPIHono(super.basePath(path))
  }
}

type RoutingPath<P extends string> = P extends `${infer Head}/{${infer Param}}${infer Tail}`
  ? `${Head}/:${Param}${RoutingPath<Tail>}`
  : P

export const createRoute = <P extends string, R extends Omit<RouteConfig, 'path'> & { path: P }>(
  routeConfig: R
) => {
  return {
    ...routeConfig,
    getRoutingPath(): RoutingPath<R['path']> {
      return routeConfig.path.replaceAll(/\/{(.+?)}/g, '/:$1') as RoutingPath<P>
    },
  }
}

extendZodWithOpenApi(z)
export { z }
