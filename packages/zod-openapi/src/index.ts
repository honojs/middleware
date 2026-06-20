/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  RouteConfig as RouteConfigBase,
  ZodContentObject,
  ZodMediaTypeObject,
  ZodRequestBody,
} from '@asteasolutions/zod-to-openapi'
import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  OpenApiGeneratorV31,
  extendZodWithOpenApi,
  getOpenApiMetadata,
} from '@asteasolutions/zod-to-openapi'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import type {
  Context,
  Env,
  ErrorHandler,
  Handler,
  Input,
  MiddlewareHandler,
  NotFoundHandler,
  Schema,
  ToSchema,
  TypedResponse,
  ValidationTargets,
} from 'hono'
import type { H, MergePath, MergeSchemaPath } from 'hono/types'
import type {
  ClientErrorStatusCode,
  InfoStatusCode,
  RedirectStatusCode,
  ServerErrorStatusCode,
  StatusCode,
  SuccessStatusCode,
} from 'hono/utils/http-status'
import type { JSONParsed, RemoveBlankRecord } from 'hono/utils/types'
import { mergePath } from 'hono/utils/url'
import type { OpenAPIObject } from 'openapi3-ts/oas30'
import type { OpenAPIObject as OpenAPIV31bject } from 'openapi3-ts/oas31'
import type { ZodType, ZodError } from 'zod'
import { z } from 'zod'
import { isZod } from './zod-typeguard'

type MaybePromise<T> = Promise<T> | T

export type RouteConfig = RouteConfigBase & {
  middleware?: H | H[]
  hide?: boolean
}

type RequestTypes = {
  body?: ZodRequestBody
  params?: ZodType
  query?: ZodType
  cookies?: ZodType
  headers?: ZodType | ZodType[]
}

type IsJson<T> = T extends string
  ? T extends `application/${infer Start}json${infer _End}`
    ? Start extends '' | `${string}+` | `vnd.${string}+`
      ? 'json'
      : never
    : never
  : never

type IsForm<T> = T extends string
  ? T extends
      | `multipart/form-data${infer _Rest}`
      | `application/x-www-form-urlencoded${infer _Rest}`
    ? 'form'
    : never
  : never

// `Code` is the already-resolved status code (see RouteConfigToTypedResponse,
// which binds ExtractStatusCode<Status> once and passes the result in).
type ReturnJsonOrTextOrResponse<
  ContentType,
  Content,
  Code extends StatusCode,
> = ContentType extends string
  ? ContentType extends `application/${infer Start}json${infer _End}`
    ? Start extends '' | `${string}+` | `vnd.${string}+`
      ? TypedResponse<JSONParsed<Content>, Code, 'json'>
      : never
    : ContentType extends `text/plain${infer _Rest}`
      ? TypedResponse<Content, Code, 'text'>
      : Response
  : never

type RequestPart<R extends RouteConfig, Part extends string> = Part extends keyof R['request']
  ? R['request'][Part]
  : {}

type HasUndefined<T> = undefined extends T ? true : false

type InputTypeBase<
  R extends RouteConfig,
  Part extends string,
  Type extends keyof ValidationTargets,
> = R['request'] extends RequestTypes
  ? // Bind the resolved part schema once instead of re-indexing RequestPart
    // (and re-deriving z.input) at every use site below.
    RequestPart<R, Part> extends infer Schema extends ZodType
    ? {
        in: {
          [K in Type]: HasUndefined<ValidationTargets[K]> extends true
            ? { [K2 in keyof z.input<Schema>]?: z.input<Schema>[K2] }
            : { [K2 in keyof z.input<Schema>]: z.input<Schema>[K2] }
        }
        out: { [K in Type]: z.output<Schema> }
      }
    : {}
  : {}

type InputTypeJson<R extends RouteConfig> = R['request'] extends RequestTypes
  ? R['request']['body'] extends ZodRequestBody
    ? R['request']['body']['content'] extends infer Content extends ZodContentObject
      ? IsJson<keyof Content> extends never
        ? {}
        : Content[keyof Content] extends Record<'schema', infer Schema extends ZodType<any>>
          ? { in: { json: z.input<Schema> }; out: { json: z.output<Schema> } }
          : {}
      : {}
    : {}
  : {}

type InputTypeForm<R extends RouteConfig> = R['request'] extends RequestTypes
  ? R['request']['body'] extends ZodRequestBody
    ? R['request']['body']['content'] extends infer Content extends ZodContentObject
      ? IsForm<keyof Content> extends never
        ? {}
        : Content[keyof Content] extends Record<'schema', infer Schema extends ZodType<any>>
          ? { in: { form: z.input<Schema> }; out: { form: z.output<Schema> } }
          : {}
      : {}
    : {}
  : {}

type InputTypeParam<R extends RouteConfig> = InputTypeBase<R, 'params', 'param'>
type InputTypeQuery<R extends RouteConfig> = InputTypeBase<R, 'query', 'query'>
type InputTypeHeader<R extends RouteConfig> = InputTypeBase<R, 'headers', 'header'>
type InputTypeCookie<R extends RouteConfig> = InputTypeBase<R, 'cookies', 'cookie'>

type ExtractContent<T> = T extends {
  [K in keyof T]: infer A
}
  ? A extends Record<'schema', infer Schema extends ZodType>
    ? z.infer<Schema>
    : never
  : never

type StatusCodeRangeDefinitions = {
  '1XX': InfoStatusCode
  '2XX': SuccessStatusCode
  '3XX': RedirectStatusCode
  '4XX': ClientErrorStatusCode
  '5XX': ServerErrorStatusCode
}
type RouteConfigStatusCode = keyof StatusCodeRangeDefinitions | StatusCode
type ExtractStatusCode<T extends RouteConfigStatusCode> = T extends keyof StatusCodeRangeDefinitions
  ? StatusCodeRangeDefinitions[T]
  : T
type DefinedStatusCodes<R extends RouteConfig> = keyof R['responses'] & RouteConfigStatusCode
export type RouteConfigToTypedResponse<R extends RouteConfig> =
  | {
      // Resolve the status code once and reuse it across both branches.
      [Status in DefinedStatusCodes<R>]: ExtractStatusCode<Status> extends infer Code extends
        StatusCode
        ? R['responses'][Status] extends { content: infer Content }
          ? undefined extends Content
            ? never
            : ReturnJsonOrTextOrResponse<keyof Content, ExtractContent<Content>, Code>
          : TypedResponse<{}, Code, string>
        : never
    }[DefinedStatusCodes<R>]
  | ('default' extends keyof R['responses']
      ? Exclude<StatusCode, ExtractStatusCode<DefinedStatusCodes<R>>> extends infer Code extends
          StatusCode
        ? R['responses']['default'] extends { content: infer Content }
          ? undefined extends Content
            ? never
            : ReturnJsonOrTextOrResponse<keyof Content, ExtractContent<Content>, Code>
          : TypedResponse<{}, Code, string>
        : never
      : never)

// Whether a route declares Zod-typed responses. If it does, a handler may only
// return one of the typed responses; otherwise a raw Response is also valid.
type HasZodResponses<R extends RouteConfig> = R extends {
  responses: { [statusCode: number]: { content: { [mediaType: string]: ZodMediaTypeObject } } }
}
  ? true
  : false

// Allowed handler return type for a route config. Shared by RouteHandler,
// openapi() and HandlerFromRoute; the hook variant is HandlerResponse<R> | undefined.
type HandlerResponse<R extends RouteConfig> =
  HasZodResponses<R> extends true
    ? MaybePromise<RouteConfigToTypedResponse<R>>
    : MaybePromise<RouteConfigToTypedResponse<R>> | MaybePromise<Response>

export type Hook<T, E extends Env, P extends string, R> = (
  result: { target: keyof ValidationTargets } & (
    | {
        success: true
        data: T
      }
    | {
        success: false
        error: ZodError
      }
  ),
  c: Context<E, P>
) => R

type ConvertPathType<T extends string> = T extends `${infer Start}/{${infer Param}}${infer Rest}`
  ? `${Start}/:${Param}${ConvertPathType<Rest>}`
  : T

export type OpenAPIHonoOptions<E extends Env> = {
  defaultHook?: Hook<any, E, any, any>
}
type HonoInit<E extends Env> = ConstructorParameters<typeof Hono>[0] & OpenAPIHonoOptions<E>

/**
 * Turns `T | T[] | undefined` into `T[]`
 */
type AsArray<T> = T extends undefined // TODO move to utils?
  ? []
  : T extends any[]
    ? T
    : [T]

/**
 * Like simplify but recursive
 */
export type DeepSimplify<T> = {
  // TODO move to utils?
  [KeyType in keyof T]: T[KeyType] extends Record<string, unknown>
    ? DeepSimplify<T[KeyType]>
    : T[KeyType]
} & {}

/**
 * Helper to infer generics from {@link MiddlewareHandler}
 */
export type OfHandlerType<T extends MiddlewareHandler> =
  T extends MiddlewareHandler<infer E, infer P, infer I>
    ? {
        env: E
        path: P
        input: I
      }
    : never

/**
 * Reduce a tuple of middleware handlers into a single
 * handler representing the composition of all
 * handlers.
 */
export type MiddlewareToHandlerType<M extends MiddlewareHandler<any, any, any>[]> = M extends [
  infer First,
  infer Second,
  ...infer Rest,
]
  ? First extends MiddlewareHandler<any, any, any>
    ? Second extends MiddlewareHandler<any, any, any>
      ? Rest extends MiddlewareHandler<any, any, any>[] // Ensure Rest is an array of MiddlewareHandler
        ? MiddlewareToHandlerType<
            [
              MiddlewareHandler<
                DeepSimplify<OfHandlerType<First>['env'] & OfHandlerType<Second>['env']>, // Combine envs
                OfHandlerType<First>['path'], // Keep path from First
                OfHandlerType<First>['input'] // Keep input from First
              >,
              ...Rest,
            ]
          >
        : never
      : never
    : never
  : M extends [infer Last]
    ? Last // Return the last remaining handler in the array
    : MiddlewareHandler<Env>

type RouteMiddlewareParams<R extends RouteConfig> = OfHandlerType<
  MiddlewareToHandlerType<AsArray<R['middleware']>>
>

export type RouteConfigToEnv<R extends RouteConfig> =
  RouteMiddlewareParams<R> extends never ? Env : RouteMiddlewareParams<R>['env']

export type RouteHandler<
  R extends RouteConfig,
  E extends Env = RouteConfigToEnv<R>,
  I extends Input = ComputeInput<R>,
  P extends string = ConvertPathType<R['path']>,
  // If a response type is defined, only the typed response is allowed.
> = Handler<E, P, I, HandlerResponse<R>>

export type RouteHook<
  R extends RouteConfig,
  E extends Env = RouteConfigToEnv<R>,
  I extends Input = ComputeInput<R>,
  P extends string = ConvertPathType<R['path']>,
> = Hook<
  I,
  E,
  P,
  RouteConfigToTypedResponse<R> | Response | Promise<Response> | void | Promise<void>
>

type OpenAPIObjectConfig = Parameters<
  InstanceType<typeof OpenApiGeneratorV3>['generateDocument']
>[0]

export type OpenAPIObjectConfigure<E extends Env, P extends string> =
  | OpenAPIObjectConfig
  | ((context: Context<E, P>) => OpenAPIObjectConfig)

export type OpenAPIGeneratorOptions = ConstructorParameters<typeof OpenApiGeneratorV3>[1]

export type OpenAPIGeneratorConfigure<E extends Env, P extends string> =
  | OpenAPIGeneratorOptions
  | ((context: Context<E, P>) => OpenAPIGeneratorOptions)

/**
 * Utility type to convert Hono types to OpenAPIHono types.
 * Replaces Hono return types with OpenAPIHono in function signatures.
 *
 * @example
 * ```ts
 * type MyOpenAPIHono = HonoToOpenAPIHono<Hono<Env>>
 * ```
 */
export type HonoToOpenAPIHono<T> =
  T extends Hono<infer E, infer S, infer B> ? OpenAPIHono<E, S, B> : T

/**
 * Converts a Hono instance to OpenAPIHono type.
 * Use this function to restore the OpenAPIHono type after chaining methods like `get`, `post`, `use`, etc.
 * @example
 * ```ts
 * import { OpenAPIHono, $ } from '@hono/zod-openapi'
 *
 * const app = $(
 *   new OpenAPIHono().use(middleware)
 * )
 * app.openapi(route, handler)
 * ```
 */
export const $ = <T extends Hono<any, any, any>>(app: T): HonoToOpenAPIHono<T> => {
  return app as HonoToOpenAPIHono<T>
}

// Helper: Consolidate all Input types (Query, Param, Json, etc.)
type ComputeInput<R extends RouteConfig> = InputTypeParam<R> &
  InputTypeQuery<R> &
  InputTypeHeader<R> &
  InputTypeCookie<R> &
  InputTypeForm<R> &
  InputTypeJson<R>

// Helper: Calculate the expected Handler type for a specific RouteConfig
type HandlerFromRoute<R extends RouteConfig, E extends Env> = Handler<
  E,
  ConvertPathType<R['path']>,
  ComputeInput<R>,
  HandlerResponse<R>
>

type HookFromRoute<R extends RouteConfig, E extends Env> =
  | Hook<ComputeInput<R>, E, ConvertPathType<R['path']>, HandlerResponse<R> | undefined>
  | undefined

// Recursive Helper: Merge Schemas for the Return Type
type SchemaFromRoutes<
  Routes extends readonly { route: RouteConfig; addRoute?: boolean }[],
  BasePath extends string,
> = Routes extends readonly [infer Head, ...infer Tail]
  ? Head extends { route: infer R extends RouteConfig; addRoute?: infer AddRoute }
    ? ([AddRoute] extends [false]
        ? {}
        : ToSchema<
            R['method'],
            MergePath<BasePath, ConvertPathType<R['path']>>,
            ComputeInput<R>,
            RouteConfigToTypedResponse<R>
          >) &
        SchemaFromRoutes<
          Tail extends readonly { route: RouteConfig; addRoute?: boolean }[] ? Tail : [],
          BasePath
        >
    : {}
  : {}

export type OpenAPIRoute<
  R extends RouteConfig = RouteConfig,
  E extends Env = Env,
  AddRoute extends boolean | undefined = boolean | undefined,
> = {
  route: R
  handler: HandlerFromRoute<R, E>
  hook?: HookFromRoute<R, E>
  addRoute?: AddRoute
}

export const defineOpenAPIRoute = <
  R extends RouteConfig,
  E extends Env = Env,
  const AddRoute extends boolean | undefined = undefined,
>(
  def: OpenAPIRoute<R, E, AddRoute>
): OpenAPIRoute<R, E, AddRoute> => {
  return def
}

export class OpenAPIHono<
  E extends Env = Env,
  S extends Schema = {},
  BasePath extends string = '/',
> extends Hono<E, S, BasePath> {
  openAPIRegistry: OpenAPIRegistry
  defaultHook?: OpenAPIHonoOptions<E>['defaultHook']

  constructor(init?: HonoInit<E>) {
    super(init)
    this.openAPIRegistry = new OpenAPIRegistry()
    this.defaultHook = init?.defaultHook
  }

  /**
   *
   * @param {RouteConfig} route - The route definition which you create with `createRoute()`.
   * @param {Handler} handler - The handler. If you want to return a JSON object, you should specify the status code with `c.json()`.
   * @param {Hook} hook - Optional. The hook method defines what it should do after validation.
   * @example
   * app.openapi(
   *   route,
   *   (c) => {
   *     // ...
   *     return c.json(
   *       {
   *         age: 20,
   *         name: 'Young man',
   *       },
   *       200 // You should specify the status code even if it's 200.
   *     )
   *   },
   *  (result, c) => {
   *    if (!result.success) {
   *      return c.json(
   *        {
   *          code: 400,
   *          message: 'Custom Message',
   *        },
   *        400
   *      )
   *    }
   *  }
   *)
   */
  openapi = <
    R extends RouteConfig,
    I extends Input = ComputeInput<R>,
    P extends string = ConvertPathType<R['path']>,
  >(
    { middleware: routeMiddleware, hide, ...route }: R,
    handler: Handler<
      // use the env from the middleware if it's defined
      R['middleware'] extends MiddlewareHandler[] | MiddlewareHandler
        ? RouteMiddlewareParams<R>['env'] & E
        : E,
      P,
      I,
      // If a response type is defined, only the typed response is allowed.
      HandlerResponse<R>
    >,
    hook: Hook<I, E, P, HandlerResponse<R> | undefined> | undefined = this.defaultHook
  ): OpenAPIHono<
    E,
    S & ToSchema<R['method'], MergePath<BasePath, P>, I, RouteConfigToTypedResponse<R>>,
    BasePath
  > => {
    if (!hide) {
      this.openAPIRegistry.registerPath(route)
    }

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
        if (!bodyContent[mediaType]) {
          continue
        }
        const schema = (bodyContent[mediaType] as ZodMediaTypeObject)['schema']
        if (!isZod(schema)) {
          continue
        }
        if (isJSONContentType(mediaType)) {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore we can ignore the type error since Zod Validator's types are not used
          const validator = zValidator('json', schema, hook) as MiddlewareHandler
          if (route.request?.body?.required) {
            validators.push(validator)
          } else {
            const mw: MiddlewareHandler = async (c, next) => {
              if (c.req.header('content-type')) {
                if (isJSONContentType(c.req.header('content-type')!)) {
                  return await validator(c, next)
                }
              }
              c.req.addValidatedData('json', {})
              await next()
            }
            validators.push(mw)
          }
        }
        if (isFormContentType(mediaType)) {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore we can ignore the type error since Zod Validator's types are not used
          const validator = zValidator('form', schema, hook) as MiddlewareHandler
          if (route.request?.body?.required) {
            validators.push(validator)
          } else {
            const mw: MiddlewareHandler = async (c, next) => {
              if (c.req.header('content-type')) {
                if (isFormContentType(c.req.header('content-type')!)) {
                  return await validator(c, next)
                }
              }
              c.req.addValidatedData('form', {})
              await next()
            }
            validators.push(mw)
          }
        }
      }
    }

    const middleware = routeMiddleware
      ? Array.isArray(routeMiddleware)
        ? routeMiddleware
        : [routeMiddleware]
      : []

    this.on(
      [route.method],
      [route.path.replaceAll(/\/{(.+?)}/g, '/:$1')],
      ...middleware,
      ...validators,
      handler
    )
    return this
  }

  /**
   * Register a list of routes with full Type Safety and RPC support.
   * * @param inputs - An array of objects containing { route, handler, hook }.
   * Must be defined `as const` or inline to preserve tuple types.
   */
  openapiRoutes = <
    const Inputs extends readonly {
      route: RouteConfig
      handler: any
      hook?: any
      addRoute?: boolean
    }[],
  >(
    inputs: Inputs
  ): OpenAPIHono<E, S & SchemaFromRoutes<Inputs, BasePath>, BasePath> => {
    type Result = {
      [K in keyof Inputs]: Inputs[K] extends {
        route: infer R extends RouteConfig
        addRoute?: infer AR extends boolean | undefined
      }
        ? OpenAPIRoute<R, E, AR>
        : never
    }

    const typedInputs = inputs as unknown as Result

    typedInputs
      .filter(({ addRoute }) => addRoute !== false)
      .forEach(({ route, handler, hook }) => {
        this.openapi(route, handler, hook)
      })
    return this
  }

  getOpenAPIDocument = (
    objectConfig: OpenAPIObjectConfig,
    generatorConfig?: OpenAPIGeneratorOptions
  ): OpenAPIObject => {
    const generator = new OpenApiGeneratorV3(this.openAPIRegistry.definitions, generatorConfig)
    const document = generator.generateDocument(objectConfig)
    // @ts-expect-error the _basePath is a private property
    return this._basePath ? addBasePathToDocument(document, this._basePath) : document
  }

  getOpenAPI31Document = (
    objectConfig: OpenAPIObjectConfig,
    generatorConfig?: OpenAPIGeneratorOptions
  ): OpenAPIV31bject => {
    const generator = new OpenApiGeneratorV31(this.openAPIRegistry.definitions, generatorConfig)
    const document = generator.generateDocument(objectConfig)
    // @ts-expect-error the _basePath is a private property
    return this._basePath ? addBasePathToDocument(document, this._basePath) : document
  }

  doc = <P extends string>(
    path: P,
    configureObject: OpenAPIObjectConfigure<E, P>,
    configureGenerator?: OpenAPIGeneratorConfigure<E, P>
  ): OpenAPIHono<E, S & ToSchema<'get', MergePath<BasePath, P>, {}, {}>, BasePath> => {
    return this.get(path, (c) => {
      const objectConfig =
        typeof configureObject === 'function' ? configureObject(c) : configureObject
      const generatorConfig =
        typeof configureGenerator === 'function' ? configureGenerator(c) : configureGenerator
      try {
        const document = this.getOpenAPIDocument(objectConfig, generatorConfig)
        return c.json(document)
      } catch (e: any) {
        return c.json(e, 500)
      }
    }) as any
  }

  doc31 = <P extends string>(
    path: P,
    configureObject: OpenAPIObjectConfigure<E, P>,
    configureGenerator?: OpenAPIGeneratorConfigure<E, P>
  ): OpenAPIHono<E, S & ToSchema<'get', MergePath<BasePath, P>, {}, {}>, BasePath> => {
    return this.get(path, (c) => {
      const objectConfig =
        typeof configureObject === 'function' ? configureObject(c) : configureObject
      const generatorConfig =
        typeof configureGenerator === 'function' ? configureGenerator(c) : configureGenerator
      try {
        const document = this.getOpenAPI31Document(objectConfig, generatorConfig)
        return c.json(document)
      } catch (e: any) {
        return c.json(e, 500)
      }
    }) as any
  }

  override route<
    SubPath extends string,
    SubEnv extends Env,
    SubSchema extends Schema,
    SubBasePath extends string,
  >(
    path: SubPath,
    app: Hono<SubEnv, SubSchema, SubBasePath>
  ): OpenAPIHono<E, MergeSchemaPath<SubSchema, MergePath<BasePath, SubPath>> & S, BasePath>
  override route<SubPath extends string>(path: SubPath): Hono<E, RemoveBlankRecord<S>, BasePath>
  override route<
    SubPath extends string,
    SubEnv extends Env,
    SubSchema extends Schema,
    SubBasePath extends string,
  >(
    path: SubPath,
    app?: Hono<SubEnv, SubSchema, SubBasePath>
  ): OpenAPIHono<E, MergeSchemaPath<SubSchema, MergePath<BasePath, SubPath>> & S, BasePath> {
    const pathForOpenAPI = path.replaceAll(/:([^\/]+)/g, '{$1}')
    super.route(path, app as any)

    if (!(app instanceof OpenAPIHono)) {
      return this as any
    }

    app.openAPIRegistry.definitions.forEach((def) => {
      switch (def.type) {
        case 'component':
          return this.openAPIRegistry.registerComponent(def.componentType, def.name, def.component)

        case 'route': {
          this.openAPIRegistry.registerPath({
            ...def.route,
            path: mergePath(
              pathForOpenAPI,
              // @ts-expect-error _basePath is private
              app._basePath.replaceAll(/:([^\/]+)/g, '{$1}'),
              def.route.path
            ),
          })
          return
        }

        case 'webhook': {
          this.openAPIRegistry.registerWebhook({
            ...def.webhook,
            path: mergePath(
              pathForOpenAPI,
              // @ts-expect-error _basePath is private
              app._basePath.replaceAll(/:([^\/]+)/g, '{$1}'),
              def.webhook.path
            ),
          })
          return
        }

        case 'schema':
          return this.openAPIRegistry.register(
            getOpenApiMetadata(def.schema)._internal?.refId,
            def.schema
          )

        case 'parameter':
          return this.openAPIRegistry.registerParameter(
            getOpenApiMetadata(def.schema)._internal?.refId,
            def.schema
          )

        default: {
          const errorIfNotExhaustive: never = def
          throw new Error(`Unknown registry type: ${errorIfNotExhaustive}`)
        }
      }
    })

    return this as any
  }

  override basePath<SubPath extends string>(
    path: SubPath
  ): OpenAPIHono<E, S, MergePath<BasePath, SubPath>> {
    return new OpenAPIHono({ ...(super.basePath(path) as any), defaultHook: this.defaultHook })
  }

  // Type overrides to return OpenAPIHono instead of Hono
  declare onError: (handler: ErrorHandler<E>) => OpenAPIHono<E, S, BasePath>
  declare notFound: (handler: NotFoundHandler<E>) => OpenAPIHono<E, S, BasePath>
}

export const createRoute = <P extends string, R extends Omit<RouteConfig, 'path'> & { path: P }>(
  routeConfig: R
): R & {
  getRoutingPath(): ConvertPathType<R['path']>
} => {
  const route = {
    ...routeConfig,
    getRoutingPath(): ConvertPathType<R['path']> {
      return routeConfig.path.replaceAll(/\/{(.+?)}/g, '/:$1') as ConvertPathType<P>
    },
  }
  return Object.defineProperty(route, 'getRoutingPath', { enumerable: false })
}

extendZodWithOpenApi(z)
export { extendZodWithOpenApi, z }

function addBasePathToDocument(document: Record<string, any>, basePath: string) {
  const updatedPaths: Record<string, any> = {}

  Object.keys(document.paths).forEach((path) => {
    updatedPaths[mergePath(basePath.replaceAll(/:([^\/]+)/g, '{$1}'), path)] = document.paths[path]
  })

  return {
    ...document,
    paths: updatedPaths,
  }
}

function isJSONContentType(contentType: string) {
  return /^application\/([a-z-\.]+\+)?json/.test(contentType)
}

function isFormContentType(contentType: string) {
  return (
    contentType.startsWith('multipart/form-data') ||
    contentType.startsWith('application/x-www-form-urlencoded')
  )
}
