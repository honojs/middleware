/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  ResponseConfig as ResponseConfigBase,
  RouteConfig as RouteConfigBase,
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
import { sValidator } from '@hono/standard-validator'
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
import type { StandardOpenAPISchema, JSONSchemaTarget } from './standard-schema'
import {
  TARGETS,
  convertRouteSchemas,
  needsConversion,
  routeUsesStandardSchema,
} from './standard-schema'
import type {
  AsArray,
  HasUndefined,
  MaybePromise,
  MiddlewareToHandlerType,
  OfHandlerType,
} from './utils'
import { toArray } from './utils'
import { isZod } from './zod-typeguard'

type AnySchema = ZodType | StandardOpenAPISchema

/**
 * Zod types implement Standard Schema too, so `ZodType` has to be checked first — otherwise
 * every Zod schema would infer through `~standard.types` and lose what `z.input`/`z.output`
 * know about transforms, defaults and pipes.
 */
type InferInput<S> = S extends ZodType
  ? z.input<S>
  : S extends StandardOpenAPISchema<infer Input, unknown>
    ? Input
    : never

type InferOutput<S> = S extends ZodType
  ? z.output<S>
  : S extends StandardOpenAPISchema<unknown, infer Output>
    ? Output
    : never

type RouteParameterBase = NonNullable<RouteConfigBase['request']>['params']

type MediaTypeObject = Omit<ZodMediaTypeObject, 'schema'> & {
  schema: ZodMediaTypeObject['schema'] | StandardOpenAPISchema
}
type ContentObject = Partial<Record<string, MediaTypeObject>>
type RequestBody = Omit<ZodRequestBody, 'content'> & { content: ContentObject }
type ResponseConfig = Omit<ResponseConfigBase, 'content' | 'headers'> & {
  content?: ContentObject
  headers?: ResponseConfigBase['headers'] | StandardOpenAPISchema
}

export type RouteConfig = Omit<RouteConfigBase, 'request' | 'responses'> & {
  request?: {
    body?: RequestBody
    params?: RouteParameterBase | StandardOpenAPISchema
    query?: RouteParameterBase | StandardOpenAPISchema
    cookies?: RouteParameterBase | StandardOpenAPISchema
    headers?:
      RouteParameterBase | ZodType<unknown>[] | StandardOpenAPISchema | StandardOpenAPISchema[]
  }
  responses: {
    [statusCode: string]: ResponseConfig
  }
  middleware?: H | H[]
  hide?: boolean
}

type RequestTypes = {
  body?: RequestBody
  params?: AnySchema
  query?: AnySchema
  cookies?: AnySchema
  headers?: AnySchema | AnySchema[]
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
      `multipart/form-data${infer _Rest}` | `application/x-www-form-urlencoded${infer _Rest}`
    ? 'form'
    : never
  : never

type ReturnJsonOrTextOrResponse<
  ContentType,
  Content,
  Status extends keyof StatusCodeRangeDefinitions | StatusCode,
> = ContentType extends string
  ? ContentType extends `application/${infer Start}json${infer _End}`
    ? Start extends '' | `${string}+` | `vnd.${string}+`
      ? TypedResponse<JSONParsed<Content>, ExtractStatusCode<Status>, 'json'>
      : never
    : ContentType extends `text/plain${infer _Rest}`
      ? TypedResponse<Content, ExtractStatusCode<Status>, 'text'>
      : Response
  : never

type RequestPart<R extends RouteConfig, Part extends string> = Part extends keyof R['request']
  ? R['request'][Part]
  : {}

type InputTypeBase<
  R extends RouteConfig,
  Part extends string,
  Type extends keyof ValidationTargets,
> = R['request'] extends RequestTypes
  ? RequestPart<R, Part> extends AnySchema
    ? {
        in: {
          [K in Type]: HasUndefined<ValidationTargets[K]> extends true
            ? {
                [K2 in keyof InferInput<RequestPart<R, Part>>]?: InferInput<
                  RequestPart<R, Part>
                >[K2]
              }
            : {
                [K2 in keyof InferInput<RequestPart<R, Part>>]: InferInput<RequestPart<R, Part>>[K2]
              }
        }
        out: { [K in Type]: InferOutput<RequestPart<R, Part>> }
      }
    : {}
  : {}

type InputTypeJson<R extends RouteConfig> = R['request'] extends RequestTypes
  ? R['request']['body'] extends RequestBody
    ? R['request']['body']['content'] extends ContentObject
      ? IsJson<keyof R['request']['body']['content']> extends never
        ? {}
        : R['request']['body']['content'][keyof R['request']['body']['content']] extends Record<
              'schema',
              AnySchema
            >
          ? {
              in: {
                json: InferInput<
                  R['request']['body']['content'][keyof R['request']['body']['content']]['schema']
                >
              }
              out: {
                json: InferOutput<
                  R['request']['body']['content'][keyof R['request']['body']['content']]['schema']
                >
              }
            }
          : {}
      : {}
    : {}
  : {}

type InputTypeForm<R extends RouteConfig> = R['request'] extends RequestTypes
  ? R['request']['body'] extends RequestBody
    ? R['request']['body']['content'] extends ContentObject
      ? IsForm<keyof R['request']['body']['content']> extends never
        ? {}
        : R['request']['body']['content'][keyof R['request']['body']['content']] extends Record<
              'schema',
              AnySchema
            >
          ? {
              in: {
                form: InferInput<
                  R['request']['body']['content'][keyof R['request']['body']['content']]['schema']
                >
              }
              out: {
                form: InferOutput<
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

type ExtractContent<T> = T extends {
  [K in keyof T]: infer A
}
  ? A extends Record<'schema', AnySchema>
    ? InferOutput<A['schema']>
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
      [Status in DefinedStatusCodes<R>]: R['responses'][Status] extends { content: infer Content }
        ? undefined extends Content
          ? never
          : ReturnJsonOrTextOrResponse<
              keyof R['responses'][Status]['content'],
              ExtractContent<R['responses'][Status]['content']>,
              Status
            >
        : TypedResponse<{}, ExtractStatusCode<Status>, string>
    }[DefinedStatusCodes<R>]
  | ('default' extends keyof R['responses']
      ? R['responses']['default'] extends { content: infer Content }
        ? undefined extends Content
          ? never
          : ReturnJsonOrTextOrResponse<
              keyof Content,
              ExtractContent<Content>,
              Exclude<StatusCode, ExtractStatusCode<DefinedStatusCodes<R>>>
            >
        : TypedResponse<{}, Exclude<StatusCode, ExtractStatusCode<DefinedStatusCodes<R>>>, string>
      : never)

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
  /**
   * JSON Schema dialects to try when converting Standard Schema libraries into an OpenAPI
   * document. Defaults try OpenAPI-native targets first, then draft fallbacks. Override when
   * a library only supports specific dialects — e.g. ArkType with OpenAPI 3.0:
   * `{ '3.0': ['draft-07'] }`.
   */
  jsonSchemaTargets?: {
    '3.0'?: JSONSchemaTarget[]
    '3.1'?: JSONSchemaTarget[]
  }
}
type HonoInit<E extends Env> = ConstructorParameters<typeof Hono>[0] & OpenAPIHonoOptions<E>

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
> = Handler<E, P, I, HandlerReturn<R>>

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
  OpenAPIObjectConfig | ((context: Context<E, P>) => OpenAPIObjectConfig)

export type OpenAPIGeneratorOptions = ConstructorParameters<typeof OpenApiGeneratorV3>[1]

export type OpenAPIGeneratorConfigure<E extends Env, P extends string> =
  OpenAPIGeneratorOptions | ((context: Context<E, P>) => OpenAPIGeneratorOptions)

/** Per-call options for document generation beyond `@asteasolutions/zod-to-openapi`. */
export type OpenAPIDocumentOptions = {
  /**
   * JSON Schema dialects to try for non-Zod schemas on this document. Overrides the app's
   * `jsonSchemaTargets` for the matching OpenAPI version.
   */
  jsonSchemaTargets?: JSONSchemaTarget[]
}

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
 * import { OpenAPIHono, $ } from '@hono/standard-json-openapi'
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

// All request input types (param, query, header, cookie, form, json) merged for a route.
type ComputeInput<R extends RouteConfig> = InputTypeParam<R> &
  InputTypeQuery<R> &
  InputTypeHeader<R> &
  InputTypeCookie<R> &
  InputTypeForm<R> &
  InputTypeJson<R>

// When the route pins response content types, only a `TypedResponse` may be returned.
type PinsResponseContent<R extends RouteConfig> = R extends {
  responses: { [statusCode: number]: { content: { [mediaType: string]: MediaTypeObject } } }
}
  ? true
  : false

// The value a route handler may return.
type HandlerReturn<R extends RouteConfig> =
  PinsResponseContent<R> extends true
    ? MaybePromise<RouteConfigToTypedResponse<R>>
    : MaybePromise<RouteConfigToTypedResponse<R>> | MaybePromise<Response>

// Like `HandlerReturn`, but for hooks, which may also return `undefined`.
type HookReturn<R extends RouteConfig> =
  PinsResponseContent<R> extends true
    ? MaybePromise<RouteConfigToTypedResponse<R>> | undefined
    : MaybePromise<RouteConfigToTypedResponse<R>> | MaybePromise<Response> | undefined

// The expected Handler type for a specific RouteConfig.
type HandlerFromRoute<R extends RouteConfig, E extends Env> = Handler<
  E,
  ConvertPathType<R['path']>,
  ComputeInput<R>,
  HandlerReturn<R>
>

type HookFromRoute<R extends RouteConfig, E extends Env> =
  Hook<ComputeInput<R>, E, ConvertPathType<R['path']>, HookReturn<R>> | undefined

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

/**
 * Picks the validator that understands the schema: Zod keeps going through `zValidator`,
 * anything else validates through its Standard Schema interface via `sValidator`.
 */
const validatorFor = (
  target: keyof ValidationTargets,
  schema: AnySchema,
  hook: any
): MiddlewareHandler =>
  needsConversion(schema)
    ? (sValidator(target, schema, hook) as MiddlewareHandler)
    : (zValidator(target as any, schema as any, hook) as MiddlewareHandler)

/** The OpenAPI ref id a Zod schema was registered under (`.openapi('Name')`), if any. */
const refIdOf = (schema: Parameters<typeof getOpenApiMetadata>[0]): string | undefined =>
  (getOpenApiMetadata(schema)._internal as { refId?: string } | undefined)?.refId

/**
 * When the body is optional, only run validation if the request's Content-Type matches;
 * otherwise treat the body as empty so handlers still get `c.req.valid(...)`.
 */
const optionalBodyValidator = (
  target: 'json' | 'form',
  validator: MiddlewareHandler,
  matches: (contentType: string) => boolean
): MiddlewareHandler => {
  return async (c, next) => {
    const contentType = c.req.header('content-type')
    if (contentType && matches(contentType)) {
      return await validator(c, next)
    }
    c.req.addValidatedData(target, {})
    await next()
  }
}

export class OpenAPIHono<
  E extends Env = Env,
  S extends Schema = {},
  BasePath extends string = '/',
> extends Hono<E, S, BasePath> {
  openAPIRegistry: OpenAPIRegistry
  defaultHook?: OpenAPIHonoOptions<E>['defaultHook']
  #parentApp?: OpenAPIHono<any, any, any>
  #standardRoutes: RouteConfig[] = []
  #jsonSchemaTargets: NonNullable<OpenAPIHonoOptions<E>['jsonSchemaTargets']>

  constructor(init?: HonoInit<E>) {
    super(init)
    this.openAPIRegistry = new OpenAPIRegistry()
    this.defaultHook = init?.defaultHook
    this.#jsonSchemaTargets = init?.jsonSchemaTargets ?? {}
  }

  #resolveDefaultHook(): OpenAPIHonoOptions<any>['defaultHook'] {
    if (this.defaultHook) {
      return this.defaultHook
    }
    const seen = new Set<OpenAPIHono<any, any, any>>([this])
    let parent = this.#parentApp
    while (parent && !seen.has(parent)) {
      if (parent.defaultHook) {
        return parent.defaultHook
      }
      seen.add(parent)
      parent = parent.#parentApp
    }
    return undefined
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
      HandlerReturn<R>
    >,
    hook: Hook<I, E, P, HookReturn<R>> | undefined = undefined // eslint-disable-line @typescript-eslint/no-useless-default-assignment
  ): OpenAPIHono<
    E,
    S & ToSchema<R['method'], MergePath<BasePath, P>, I, RouteConfigToTypedResponse<R>>,
    BasePath
  > => {
    if (!hide) {
      if (routeUsesStandardSchema(route)) {
        this.#standardRoutes.push(route)
      } else {
        this.openAPIRegistry.registerPath(route as RouteConfigBase)
      }
    }

    const effectiveHook: Hook<I, E, P, HookReturn<R>> = hook ??
    ((result, c) => {
      const resolved = this.#resolveDefaultHook()
      return resolved?.(result, c) as HookReturn<R> | undefined
    })

    const validators: MiddlewareHandler[] = []

    if (route.request?.query) {
      validators.push(validatorFor('query', route.request.query as AnySchema, effectiveHook))
    }

    if (route.request?.params) {
      validators.push(validatorFor('param', route.request.params as AnySchema, effectiveHook))
    }

    if (route.request?.headers) {
      validators.push(validatorFor('header', route.request.headers as AnySchema, effectiveHook))
    }

    if (route.request?.cookies) {
      validators.push(validatorFor('cookie', route.request.cookies as AnySchema, effectiveHook))
    }

    const bodyContent = route.request?.body?.content
    const bodyRequired = route.request?.body?.required

    for (const [mediaType, media] of Object.entries(bodyContent ?? {})) {
      if (!media) {
        continue
      }
      const schema = (media as MediaTypeObject).schema
      if (!isZod(schema) && !needsConversion(schema)) {
        continue
      }

      if (isJSONContentType(mediaType)) {
        const validator = validatorFor('json', schema as AnySchema, effectiveHook)
        validators.push(
          bodyRequired ? validator : optionalBodyValidator('json', validator, isJSONContentType)
        )
      }

      if (isFormContentType(mediaType)) {
        const validator = validatorFor('form', schema as AnySchema, effectiveHook)
        validators.push(
          bodyRequired ? validator : optionalBodyValidator('form', validator, isFormContentType)
        )
      }
    }

    const middleware = toArray(routeMiddleware)

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

  #definitionsFor(
    version: '3.0' | '3.1',
    jsonSchemaTargets?: JSONSchemaTarget[]
  ): OpenAPIRegistry['definitions'] {
    if (this.#standardRoutes.length === 0) {
      return this.openAPIRegistry.definitions
    }

    const targets = jsonSchemaTargets ?? this.#jsonSchemaTargets[version] ?? TARGETS[version]
    const registry = new OpenAPIRegistry()
    registry.definitions.push(...this.openAPIRegistry.definitions)
    for (const route of this.#standardRoutes) {
      registry.registerPath(convertRouteSchemas(route, targets) as RouteConfigBase)
    }
    return registry.definitions
  }

  getOpenAPIDocument = (
    objectConfig: OpenAPIObjectConfig,
    generatorConfig?: OpenAPIGeneratorOptions,
    documentOptions?: OpenAPIDocumentOptions
  ): OpenAPIObject => {
    const generator = new OpenApiGeneratorV3(
      this.#definitionsFor('3.0', documentOptions?.jsonSchemaTargets),
      generatorConfig
    )
    const document = generator.generateDocument(objectConfig)
    const basePath = (this as unknown as { _basePath?: string })._basePath
    return basePath ? addBasePathToDocument(document, basePath) : document
  }

  getOpenAPI31Document = (
    objectConfig: OpenAPIObjectConfig,
    generatorConfig?: OpenAPIGeneratorOptions,
    documentOptions?: OpenAPIDocumentOptions
  ): OpenAPIV31bject => {
    const generator = new OpenApiGeneratorV31(
      this.#definitionsFor('3.1', documentOptions?.jsonSchemaTargets),
      generatorConfig
    )
    const document = generator.generateDocument(objectConfig)
    const basePath = (this as unknown as { _basePath?: string })._basePath
    return basePath ? addBasePathToDocument(document, basePath) : document
  }

  doc = <P extends string>(
    path: P,
    configureObject: OpenAPIObjectConfigure<E, P>,
    configureGenerator?: OpenAPIGeneratorConfigure<E, P>,
    documentOptions?: OpenAPIDocumentOptions
  ): OpenAPIHono<E, S & ToSchema<'get', MergePath<BasePath, P>, {}, {}>, BasePath> => {
    return this.get(path, (c) => {
      const objectConfig =
        typeof configureObject === 'function' ? configureObject(c) : configureObject
      const generatorConfig =
        typeof configureGenerator === 'function' ? configureGenerator(c) : configureGenerator
      try {
        const document = this.getOpenAPIDocument(objectConfig, generatorConfig, documentOptions)
        return c.json(document)
      } catch (e: any) {
        return c.json(e, 500)
      }
    }) as any
  }

  doc31 = <P extends string>(
    path: P,
    configureObject: OpenAPIObjectConfigure<E, P>,
    configureGenerator?: OpenAPIGeneratorConfigure<E, P>,
    documentOptions?: OpenAPIDocumentOptions
  ): OpenAPIHono<E, S & ToSchema<'get', MergePath<BasePath, P>, {}, {}>, BasePath> => {
    return this.get(path, (c) => {
      const objectConfig =
        typeof configureObject === 'function' ? configureObject(c) : configureObject
      const generatorConfig =
        typeof configureGenerator === 'function' ? configureGenerator(c) : configureGenerator
      try {
        const document = this.getOpenAPI31Document(objectConfig, generatorConfig, documentOptions)
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

    app.#parentApp ??= this

    const subBasePath = (app as unknown as { _basePath: string })._basePath.replaceAll(
      /:([^\/]+)/g,
      '{$1}'
    )

    for (const route of app.#standardRoutes) {
      this.#standardRoutes.push({
        ...route,
        path: mergePath(pathForOpenAPI, subBasePath, route.path),
      })
    }

    app.openAPIRegistry.definitions.forEach((def) => {

      switch (def.type) {
        case 'component':
          return this.openAPIRegistry.registerComponent(def.componentType, def.name, def.component)

        case 'route': {
          this.openAPIRegistry.registerPath({
            ...def.route,
            path: mergePath(pathForOpenAPI, subBasePath, def.route.path),
          })
          return
        }

        case 'webhook': {
          this.openAPIRegistry.registerWebhook({
            ...def.webhook,
            path: mergePath(pathForOpenAPI, subBasePath, def.webhook.path),
          })
          return
        }

        case 'schema': {
          const refId = refIdOf(def.schema)
          if (refId) {
            this.openAPIRegistry.register(refId, def.schema)
          }
          return
        }

        case 'parameter': {
          const refId = refIdOf(def.schema)
          if (refId) {
            this.openAPIRegistry.registerParameter(refId, def.schema)
          }
          return
        }

        default: {
          const exhaustive: never = def
          throw new Error(`Unknown registry type: ${JSON.stringify(exhaustive)}`)
        }
      }
    })

    return this as any
  }

  override basePath<SubPath extends string>(
    path: SubPath
  ): OpenAPIHono<E, S, MergePath<BasePath, SubPath>> {
    const cloned = super.basePath(path)
    const newApp = new OpenAPIHono<E, S, MergePath<BasePath, SubPath>>({
      defaultHook: this.defaultHook,
      jsonSchemaTargets: this.#jsonSchemaTargets,
    })
    newApp.router = cloned.router
    newApp.routes = cloned.routes
    const { getPath } = cloned

    const clonedInternal = cloned as unknown as { errorHandler: ErrorHandler<E>; _basePath: string }
    Object.assign(newApp, {
      getPath,
      errorHandler: clonedInternal.errorHandler,
      _basePath: clonedInternal._basePath,
    })
    return newApp
  }

  // Type overrides to return OpenAPIHono instead of Hono
  declare onError: (handler: ErrorHandler<E>) => OpenAPIHono<E, S, BasePath>
  declare notFound: (handler: NotFoundHandler<E>) => OpenAPIHono<E, S, BasePath>
}

type RoutingPath<P extends string> = P extends `${infer Head}/{${infer Param}}${infer Tail}`
  ? `${Head}/:${Param}${RoutingPath<Tail>}`
  : P

export const createRoute = <P extends string, R extends Omit<RouteConfig, 'path'> & { path: P }>(
  routeConfig: R
): R & {
  getRoutingPath(): RoutingPath<R['path']>
} => {
  const route = {
    ...routeConfig,
    getRoutingPath(): RoutingPath<R['path']> {
      return routeConfig.path.replaceAll(/\/{(.+?)}/g, '/:$1') as RoutingPath<P>
    },
  }
  return Object.defineProperty(route, 'getRoutingPath', { enumerable: false })
}

extendZodWithOpenApi(z)
export { extendZodWithOpenApi, z }
export type { JSONSchemaTarget }
export { TARGETS }
export type { DeepSimplify, MiddlewareToHandlerType, OfHandlerType } from './utils'

function addBasePathToDocument<T extends { paths?: Record<string, unknown> }>(
  document: T,
  basePath: string
): T {
  const normalizedBasePath = basePath.replaceAll(/:([^\/]+)/g, '{$1}')
  const updatedPaths: Record<string, unknown> = {}

  for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
    updatedPaths[mergePath(normalizedBasePath, path)] = pathItem
  }

  return { ...document, paths: updatedPaths } as T
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
