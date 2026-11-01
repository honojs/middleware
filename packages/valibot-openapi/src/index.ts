/* eslint-disable @typescript-eslint/no-explicit-any */
import { vValidator } from '@hono/valibot-validator'
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
import { HTTPException } from 'hono/http-exception'
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
import type { BaseIssue, GenericSchema, InferInput, InferOutput } from 'valibot'
import * as v from './valibot-openapi'
import type {
  GeneratorOptions,
  OpenAPI,
  OpenAPIObjectConfig,
  Registry,
  RequestBodyConfig,
  RouteConfig as RouteConfigBase,
} from './valibot-openapi'
import { isValibot } from './valibot-typeguard'

type MaybePromise<T> = Promise<T> | T

export type RouteConfig = RouteConfigBase & {
  middleware?: H | H[]
  hide?: boolean
}

type RequestTypes = {
  body?: RequestBodyConfig
  params?: GenericSchema
  query?: GenericSchema
  cookies?: GenericSchema
  headers?: GenericSchema | readonly GenericSchema[]
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
  ? RequestPart<R, Part> extends infer S extends GenericSchema
    ? {
        in: {
          [K in Type]: HasUndefined<ValidationTargets[K]> extends true
            ? { [K2 in keyof InferInput<S>]?: InferInput<S>[K2] }
            : { [K2 in keyof InferInput<S>]: InferInput<S>[K2] }
        }
        out: { [K in Type]: InferOutput<S> }
      }
    : {}
  : {}

type BodyContent<R extends RouteConfig> = R['request'] extends RequestTypes
  ? R['request']['body'] extends RequestBodyConfig
    ? R['request']['body']['content']
    : never
  : never

type InputTypeJson<R extends RouteConfig> =
  BodyContent<R> extends infer Content
    ? [Content] extends [never]
      ? {}
      : IsJson<keyof Content> extends never
        ? {}
        : Content[keyof Content] extends Record<'schema', infer S extends GenericSchema>
          ? { in: { json: InferInput<S> }; out: { json: InferOutput<S> } }
          : {}
    : {}

type InputTypeForm<R extends RouteConfig> =
  BodyContent<R> extends infer Content
    ? [Content] extends [never]
      ? {}
      : IsForm<keyof Content> extends never
        ? {}
        : Content[keyof Content] extends Record<'schema', infer S extends GenericSchema>
          ? { in: { form: InferInput<S> }; out: { form: InferOutput<S> } }
          : {}
    : {}

type InputTypeParam<R extends RouteConfig> = InputTypeBase<R, 'params', 'param'>
type InputTypeQuery<R extends RouteConfig> = InputTypeBase<R, 'query', 'query'>
type InputTypeHeader<R extends RouteConfig> = InputTypeBase<R, 'headers', 'header'>
type InputTypeCookie<R extends RouteConfig> = InputTypeBase<R, 'cookies', 'cookie'>

type ExtractContent<T> = T extends {
  [K in keyof T]: infer A
}
  ? A extends Record<'schema', infer S extends GenericSchema>
    ? InferOutput<S>
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

// A route whose every response declares a Valibot content schema.
type TypedContentRoute = {
  responses: {
    [statusCode: number]: { content: { [mediaType: string]: { schema: GenericSchema } } }
  }
}

// Allowed handler return type for a route config. The bare `R` keeps the
// conditional distributive, so unions of routes keep each member's response type.
type RouteHandlerResponse<R extends RouteConfig> = R extends TypedContentRoute
  ? MaybePromise<RouteConfigToTypedResponse<R>>
  : MaybePromise<RouteConfigToTypedResponse<R>> | MaybePromise<Response>

// The openapi() signature needs the projected response for both contextual
// handler checking and the returned Hono schema. Bind it inside one internal alias
// without introducing an inference-blocking public generic.
type BoundRouteResponseTypes<R extends RouteConfig> = R extends RouteConfig
  ? [RouteConfigToTypedResponse<R>] extends [infer Output]
    ? {
        output: Output
        handler: R extends TypedContentRoute
          ? MaybePromise<Output>
          : MaybePromise<Output> | MaybePromise<Response>
      }
    : never
  : never

/**
 * The result handed to a hook: valibot's `safeParse` result plus the validation target.
 */
export type Hook<T, E extends Env, P extends string, R> = (
  result: { target: keyof ValidationTargets } & (
    | {
        success: true
        output: T
        issues: undefined
      }
    | {
        success: false
        output: unknown
        issues: [BaseIssue<unknown>, ...BaseIssue<unknown>[]]
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

type AsArray<T> = T extends undefined ? [] : T extends any[] ? T : [T]

export type DeepSimplify<T> = {
  [KeyType in keyof T]: T[KeyType] extends Record<string, unknown>
    ? DeepSimplify<T[KeyType]>
    : T[KeyType]
} & {}

export type OfHandlerType<T extends MiddlewareHandler> =
  T extends MiddlewareHandler<infer E, infer P, infer I>
    ? {
        env: E
        path: P
        input: I
      }
    : never

export type MiddlewareToHandlerType<M extends MiddlewareHandler<any, any, any>[]> = M extends [
  infer First,
  infer Second,
  ...infer Rest,
]
  ? First extends MiddlewareHandler<any, any, any>
    ? Second extends MiddlewareHandler<any, any, any>
      ? Rest extends MiddlewareHandler<any, any, any>[]
        ? MiddlewareToHandlerType<
            [
              MiddlewareHandler<
                DeepSimplify<OfHandlerType<First>['env'] & OfHandlerType<Second>['env']>,
                OfHandlerType<First>['path'],
                OfHandlerType<First>['input']
              >,
              ...Rest,
            ]
          >
        : never
      : never
    : never
  : M extends [infer Last]
    ? Last
    : MiddlewareHandler<Env>

type RouteMiddlewareParams<R extends RouteConfig> = OfHandlerType<
  MiddlewareToHandlerType<AsArray<R['middleware']>>
>

export type RouteConfigToEnv<R extends RouteConfig> =
  RouteMiddlewareParams<R> extends never ? Env : RouteMiddlewareParams<R>['env']

type ComputeInput<R extends RouteConfig> = InputTypeParam<R> &
  InputTypeQuery<R> &
  InputTypeHeader<R> &
  InputTypeCookie<R> &
  InputTypeForm<R> &
  InputTypeJson<R>

export type RouteHandler<
  R extends RouteConfig,
  E extends Env = RouteConfigToEnv<R>,
  I extends Input = ComputeInput<R>,
  P extends string = ConvertPathType<R['path']>,
> = Handler<E, P, I, RouteHandlerResponse<R>>

export type RouteHook<
  R extends RouteConfig,
  E extends Env = RouteConfigToEnv<R>,
  I extends Input = ComputeInput<R>,
  P extends string = ConvertPathType<R['path']>,
> = Hook<
  I,
  E,
  P,
  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type -- a hook may return nothing
  RouteConfigToTypedResponse<R> | Response | Promise<Response> | void | Promise<void>
>

export type OpenAPIObjectConfigure<E extends Env, P extends string> =
  OpenAPIObjectConfig | ((context: Context<E, P>) => OpenAPIObjectConfig)

export type OpenAPIGeneratorOptions = GeneratorOptions

export type OpenAPIGeneratorConfigure<E extends Env, P extends string> =
  OpenAPIGeneratorOptions | ((context: Context<E, P>) => OpenAPIGeneratorOptions)

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
 * import { OpenAPIHono, $ } from '@hono/valibot-openapi'
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

type HandlerFromRoute<R extends RouteConfig, E extends Env> = Handler<
  R['middleware'] extends MiddlewareHandler[] | MiddlewareHandler
    ? RouteMiddlewareParams<R>['env'] & E
    : E,
  ConvertPathType<R['path']>,
  ComputeInput<R>,
  RouteHandlerResponse<R>
>

type HookFromRoute<R extends RouteConfig, E extends Env> =
  | Hook<ComputeInput<R>, E, ConvertPathType<R['path']>, RouteHandlerResponse<R> | undefined>
  | undefined

type SchemaFromRoute<Entry, BasePath extends string> = Entry extends {
  route: infer R extends RouteConfig
  addRoute?: infer AddRoute
}
  ? [AddRoute] extends [false]
    ? {}
    : ToSchema<
        R['method'],
        MergePath<BasePath, ConvertPathType<R['path']>>,
        ComputeInput<R>,
        RouteConfigToTypedResponse<R>
      >
  : {}

type UnionToIntersection<T> = (T extends unknown ? (value: T) => void : never) extends (
  value: infer Intersection
) => void
  ? Intersection
  : never

type NormalizeSchema<S> = { [Path in keyof S]: S[Path] }

type SchemaFromRoutes<
  Routes extends readonly { route: RouteConfig; addRoute?: boolean }[],
  BasePath extends string,
> = number extends Routes['length']
  ? {}
  : Routes extends readonly []
    ? {}
    : NormalizeSchema<UnionToIntersection<SchemaFromRoute<Routes[number], BasePath>>>

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

/**
 * Defines a `{ route, handler, hook }` entry for `openapiRoutes` with the handler and hook
 * typed from the route.
 *
 * @example
 * const getUser = defineOpenAPIRoute({
 *   route: createRoute({ method: 'get', path: '/users/{id}', ... }),
 *   handler: (c) => c.json({ id: c.req.valid('param').id }, 200),
 * })
 */
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
 * Thrown by `getOpenAPIDocument` when the document cannot be generated. The structured error
 * of the generator is kept as `cause`.
 */
export class OpenAPIGenerationError extends Error {
  override readonly cause: v.ValibotToOpenAPIError
  constructor(cause: v.ValibotToOpenAPIError) {
    super(cause.message)
    this.name = 'OpenAPIGenerationError'
    this.cause = cause
  }
}

export class OpenAPIHono<
  E extends Env = Env,
  S extends Schema = {},
  BasePath extends string = '/',
> extends Hono<E, S, BasePath> {
  openAPIRegistry: Registry
  defaultHook?: OpenAPIHonoOptions<E>['defaultHook']
  #parentApp?: OpenAPIHono<any, any, any>

  constructor(init?: HonoInit<E>) {
    super(init)
    this.openAPIRegistry = v.OpenAPIRegistry()
    this.defaultHook = init?.defaultHook
  }

  #resolveDefaultHook(): Hook<unknown, E, any, unknown> | undefined {
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
      R['middleware'] extends MiddlewareHandler[] | MiddlewareHandler
        ? RouteMiddlewareParams<R>['env'] & E
        : E,
      P,
      I,
      BoundRouteResponseTypes<R>['handler']
    >,
    hook: Hook<I, E, P, BoundRouteResponseTypes<R>['handler'] | undefined> | undefined = undefined // eslint-disable-line @typescript-eslint/no-useless-default-assignment
  ): OpenAPIHono<
    E,
    S & ToSchema<R['method'], MergePath<BasePath, P>, I, BoundRouteResponseTypes<R>['output']>,
    BasePath
  > => {
    if (!hide) {
      this.openAPIRegistry.registerPath(route)
    }

    const effectiveHook: Hook<any, E, any, any> =
      hook ?? ((result, c): unknown => this.#resolveDefaultHook()?.(result, c))

    const validate = (target: keyof ValidationTargets, schema: GenericSchema) =>
      vValidator(target, schema, effectiveHook)

    const validators: H[] = []
    const request = route.request

    if (request?.query) {
      validators.push(validate('query', request.query))
    }
    if (request?.params) {
      validators.push(validate('param', request.params))
    }
    if (request?.headers) {
      const headers = isValibot(request.headers) ? [request.headers] : request.headers
      for (const header of headers) {
        validators.push(validate('header', header))
      }
    }
    if (request?.cookies) {
      validators.push(validate('cookie', request.cookies))
    }

    const bodyContent = request?.body?.content

    if (bodyContent) {
      const declaredMediaTypes = Object.keys(bodyContent)
      const schemaOf = (mediaType: string) => {
        const config = bodyContent[mediaType]
        return config && 'schema' in config && isValibot(config.schema) ? config.schema : undefined
      }
      const hasBodyValidator = declaredMediaTypes.some(
        (mediaType) =>
          schemaOf(mediaType) !== undefined &&
          (isJSONContentType(mediaType) || isFormContentType(mediaType))
      )
      if (hasBodyValidator) {
        const mediaTypeGate: MiddlewareHandler = async (c, next) => {
          const contentType = c.req.header('content-type')
          if (contentType) {
            if (!declaredMediaTypes.some((mediaType) => matchesMediaType(contentType, mediaType))) {
              throw new HTTPException(415, { message: 'Unsupported Media Type' })
            }
          } else if (await hasRequestBody(c)) {
            throw new HTTPException(415, { message: 'Unsupported Media Type' })
          }
          await next()
        }
        validators.push(mediaTypeGate)
      }
      for (const mediaType of declaredMediaTypes) {
        const schema = schemaOf(mediaType)
        if (!schema) {
          continue
        }
        const target = isJSONContentType(mediaType)
          ? 'json'
          : isFormContentType(mediaType)
            ? 'form'
            : undefined
        if (!target) {
          continue
        }
        const validator = validate(target, schema)
        if (request?.body?.required) {
          validators.push(validator)
          continue
        }
        const matches = target === 'json' ? isJSONContentType : isFormContentType
        validators.push(async (c, next) => {
          const contentType = c.req.header('content-type')
          if (contentType && matches(contentType)) {
            return await validator(c, next)
          }
          c.req.addValidatedData(target, {})
          await next()
        })
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
    return this as never
  }

  /**
   * Register a list of routes with full Type Safety and RPC support.
   * @param inputs - An array of objects containing { route, handler, hook }.
   * Must be defined `as const` or inline to preserve tuple types.
   */
  openapiRoutes = <
    const Inputs extends readonly {
      route: RouteConfig
      handler: unknown
      hook?: unknown
      addRoute?: boolean
    }[],
  >(
    inputs: Inputs
  ): OpenAPIHono<E, S & SchemaFromRoutes<Inputs, BasePath>, BasePath> => {
    for (const { route, handler, hook, addRoute } of inputs) {
      if (addRoute !== false) {
        this.openapi(route, handler as never, hook as never)
      }
    }
    return this as never
  }

  /**
   * Generates the OpenAPI document. The output flavour (3.0 / 3.1 / 3.2) follows
   * `objectConfig.openapi`. Throws an {@link OpenAPIGenerationError} when generation fails.
   */
  getOpenAPIDocument = (
    objectConfig: OpenAPIObjectConfig,
    generatorConfig?: OpenAPIGeneratorOptions
  ): OpenAPI => {
    const result = v.generateDocument(
      this.openAPIRegistry.definitions,
      objectConfig,
      generatorConfig
    )
    if (!result.ok) {
      throw new OpenAPIGenerationError(result.error)
    }
    const basePath = basePathOf(this)
    return basePath ? addBasePathToDocument(result.value, basePath) : result.value
  }

  /**
   * Serves the OpenAPI document as JSON on `GET path`.
   */
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
        return c.json(this.getOpenAPIDocument(objectConfig, generatorConfig))
      } catch (e) {
        return c.json(e instanceof OpenAPIGenerationError ? e.cause : { message: String(e) }, 500)
      }
    }) as never
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
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- mirrors Hono's overload
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
    super.route(path, app as never)

    if (!(app instanceof OpenAPIHono)) {
      return this as never
    }

    app.#parentApp ??= this

    const subBasePath = basePathOf(app).replaceAll(/:([^\/]+)/g, '{$1}')

    for (const def of app.openAPIRegistry.definitions) {
      switch (def.type) {
        case 'component':
          this.openAPIRegistry.registerComponent(def.componentType, def.name, def.component)
          break
        case 'route':
          this.openAPIRegistry.registerPath({
            ...def.route,
            path: mergePath(pathForOpenAPI, subBasePath, def.route.path),
          })
          break
        case 'webhook':
          this.openAPIRegistry.registerWebhook({
            ...def.webhook,
            path: mergePath(pathForOpenAPI, subBasePath, def.webhook.path),
          })
          break
        case 'schema':
          this.openAPIRegistry.register(v.getRefId(def.schema) ?? '', def.schema)
          break
        case 'parameter':
          this.openAPIRegistry.registerParameter(v.getRefId(def.schema) ?? '', def.schema)
          break
        default: {
          const errorIfNotExhaustive: never = def
          throw new Error(`Unknown registry type: ${String(errorIfNotExhaustive)}`)
        }
      }
    }

    return this as never
  }

  override basePath<SubPath extends string>(
    path: SubPath
  ): OpenAPIHono<E, S, MergePath<BasePath, SubPath>> {
    const cloned = super.basePath(path)
    const newApp = new OpenAPIHono<E, S, MergePath<BasePath, SubPath>>({
      defaultHook: this.defaultHook,
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

  declare onError: (handler: ErrorHandler<E>) => OpenAPIHono<E, S, BasePath>
  declare notFound: (handler: NotFoundHandler<E>) => OpenAPIHono<E, S, BasePath>
}

/**
 * Defines a route. `path` uses the OpenAPI `{param}` syntax.
 *
 * @example
 * const route = createRoute({
 *   method: 'get',
 *   path: '/users/{id}',
 *   request: { params: v.object({ id: v.string() }) },
 *   responses: { 200: { description: 'OK', content: { 'application/json': { schema: User } } } },
 * })
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- `P` keeps the path literal
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

export { v }
export type * from './valibot-openapi'

// `_basePath` is private in Hono, but it is the only way to know the prefix of a sub app.
function basePathOf(app: Hono<any, any, any>): string {
  return (app as unknown as { _basePath: string })._basePath
}

function addBasePathToDocument(document: OpenAPI, basePath: string): OpenAPI {
  const prefix = basePath.replaceAll(/:([^\/]+)/g, '{$1}')
  return {
    ...document,
    paths: Object.fromEntries(
      Object.entries(document.paths ?? {}).map(([path, item]) => [mergePath(prefix, path), item])
    ),
  }
}

function isJSONContentType(contentType: string) {
  return /^application\/([a-z-\.]+\+)?json/i.test(contentType)
}

function isFormContentType(contentType: string) {
  const lower = contentType.toLowerCase()
  return (
    lower.startsWith('multipart/form-data') || lower.startsWith('application/x-www-form-urlencoded')
  )
}

// Mirrors hono/validator's checks. Anything looser lets Hono skip parsing and validate {}.
const jsonRequestRegex = /^application\/([a-z-\.]+\+)?json(;\s*[a-zA-Z0-9\-]+\=([^;]+))*$/i
const multipartRequestRegex = /^multipart\/form-data(;\s?boundary=[a-zA-Z0-9'"()+_,\-./:=?]+)?$/i
const urlencodedRequestRegex = /^application\/x-www-form-urlencoded(;\s*[a-zA-Z0-9\-]+\=([^;]+))*$/i

function matchesMediaType(contentType: string, mediaType: string) {
  if (mediaType === '*/*') {
    return true
  }
  if (isJSONContentType(mediaType)) {
    return jsonRequestRegex.test(contentType)
  }
  if (isFormContentType(mediaType)) {
    return multipartRequestRegex.test(contentType) || urlencodedRequestRegex.test(contentType)
  }
  const essence = (contentType.split(';')[0] ?? '').trim().toLowerCase()
  if (mediaType.endsWith('/*')) {
    return essence.startsWith(mediaType.slice(0, -1).toLowerCase())
  }
  return essence === mediaType.toLowerCase()
}

// Peek at a clone so the body stays readable downstream and a slow body costs one chunk.
async function hasRequestBody(c: Context): Promise<boolean> {
  const raw = c.req.raw
  if (raw.body === null) {
    return false
  }
  if (raw.bodyUsed) {
    return (await c.req.arrayBuffer()).byteLength > 0
  }
  const body = raw.clone().body
  if (body === null) {
    return false
  }
  const reader = body.getReader()
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) {
        return false
      }
      if (value.byteLength > 0) {
        return true
      }
    }
  } finally {
    reader.cancel().catch(() => {})
  }
}
