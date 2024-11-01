import type { Static, TSchema } from '@sinclair/typebox'
import type { ValueError } from '@sinclair/typebox/errors'
import { type Context, type Env, Hono, type Schema } from 'hono'
import type {
  Handler,
  Input,
  MergePath,
  MergeSchemaPath,
  MiddlewareHandler,
  ToSchema,
  TypedResponse,
  ValidationTargets,
} from 'hono/types'
import type { StatusCode } from 'hono/utils/http-status'
import type { JSONParsed, RemoveBlankRecord } from 'hono/utils/types'
import { mergePath } from 'hono/utils/url'
import type { OpenAPIV3_1 } from 'openapi-types'
import type {
  ContentObject,
  ContentTypeObject,
  OpenAPIRoute,
  OpenDocsConfig,
  RequestBodyObject,
  RequestTypes,
} from './types'
import { registerSchemaPath } from './utils'
import { tbValidator } from './validator'

type MaybePromise<T> = T | Promise<T>

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

type RequestPart<R extends OpenAPIRoute, Part extends string> = Part extends keyof R['request']
  ? R['request'][Part]
  : {}

type InputTypeBase<
  R extends OpenAPIRoute,
  Part extends string,
  Type extends keyof ValidationTargets
> = R['request'] extends RequestTypes
  ? NonNullable<RequestPart<R, Part>> extends TSchema
    ? {
        in: {
          [K in Type]: Static<NonNullable<RequestPart<R, Part>>>
        }
        out: {
          [K in Type]: Static<NonNullable<RequestPart<R, Part>>>
        }
      }
    : {}
  : {}

type InputTypeParam<R extends OpenAPIRoute> = InputTypeBase<R, 'params', 'param'>
type InputTypeQuery<R extends OpenAPIRoute> = InputTypeBase<R, 'query', 'query'>
type InputTypeHeader<R extends OpenAPIRoute> = InputTypeBase<R, 'headers', 'header'>
type InputTypeCookie<R extends OpenAPIRoute> = InputTypeBase<R, 'cookies', 'cookie'>

type InputTypeJson<R extends OpenAPIRoute> = R['request'] extends RequestTypes
  ? NonNullable<R['request']['body']> extends RequestBodyObject
    ? IsJson<keyof NonNullable<R['request']['body']>['content']> extends never
      ? {}
      : NonNullable<
          NonNullable<R['request']['body']>['content'][keyof NonNullable<
            R['request']['body']
          >['content']]
        > extends Record<'schema', TSchema>
      ? {
          in: {
            json: Static<
              NonNullable<
                NonNullable<R['request']['body']>['content'][keyof NonNullable<
                  R['request']['body']
                >['content']]
              >['schema']
            >
          }
          out: {
            json: Static<
              NonNullable<
                NonNullable<R['request']['body']>['content'][keyof NonNullable<
                  R['request']['body']
                >['content']]
              >['schema']
            >
          }
        }
      : {}
    : {}
  : {}

type InputTypeForm<R extends OpenAPIRoute> = R['request'] extends RequestTypes
  ? NonNullable<R['request']['body']> extends RequestBodyObject
    ? IsForm<keyof NonNullable<R['request']['body']>['content']> extends never
      ? {}
      : NonNullable<
          NonNullable<R['request']['body']>['content'][keyof NonNullable<
            R['request']['body']
          >['content']]
        > extends Record<'schema', TSchema>
      ? {
          in: {
            form: Static<
              NonNullable<
                NonNullable<R['request']['body']>['content'][keyof NonNullable<
                  R['request']['body']
                >['content']]
              >['schema']
            >
          }
          out: {
            form: Static<
              NonNullable<
                NonNullable<R['request']['body']>['content'][keyof NonNullable<
                  R['request']['body']
                >['content']]
              >['schema']
            >
          }
        }
      : {}
    : {}
  : {}

type ExtractContent<T> = T extends {
  [K in keyof T]?: infer A
}
  ? A extends {
      schema: TSchema
    }
    ? Static<A['schema']>
    : never
  : never

type ExtractStatusCode<T extends string | number | symbol> = T extends `${number}`
  ? Extract<StatusCode, number> extends infer S
    ? T extends `${S & number}`
      ? T
      : never
    : never
  : T extends StatusCode
  ? T
  : never

export type RouteConfigToTypedResponse<R extends OpenAPIRoute> = {
  [Status in keyof R['responses']]: R['responses'][Status] extends {
    content: ContentObject
  }
    ? IsJson<keyof NonNullable<NonNullable<R['responses'][Status]>['content']>> extends never
      ? TypedResponse<{}, ExtractStatusCode<Status>, string>
      : TypedResponse<
          JSONParsed<ExtractContent<NonNullable<NonNullable<R['responses'][Status]>['content']>>>,
          ExtractStatusCode<Status>,
          'json' | 'text'
        >
    : TypedResponse<{}, ExtractStatusCode<Status>, string>
}[keyof R['responses']]

export type Hook<T, E extends Env, P extends string, R> = (
  result: { target: keyof ValidationTargets } & (
    | {
        success: true
        data: T
      }
    | {
        success: false
        errors: ValueError[]
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

export type RouteHandler<
  R extends OpenAPIRoute,
  E extends Env = Env,
  I extends Input = InputTypeParam<R> &
    InputTypeQuery<R> &
    InputTypeHeader<R> &
    InputTypeCookie<R> &
    InputTypeForm<R> &
    InputTypeJson<R>,
  P extends string = ConvertPathType<R['path']>
> = Handler<
  E,
  P,
  I,
  // If response type is defined, only TypedResponse is allowed.
  R extends {
    responses: {
      [statusCode: number]: {
        content: {
          [mediaType: string]: ContentTypeObject
        }
      }
    }
  }
    ? MaybePromise<RouteConfigToTypedResponse<R>>
    : MaybePromise<RouteConfigToTypedResponse<R>> | MaybePromise<Response>
>

export type RouteHook<
  R extends OpenAPIRoute,
  E extends Env = Env,
  I extends Input = InputTypeParam<R> &
    InputTypeQuery<R> &
    InputTypeHeader<R> &
    InputTypeCookie<R> &
    InputTypeForm<R> &
    InputTypeJson<R>,
  P extends string = ConvertPathType<R['path']>
> = Hook<
  I,
  E,
  P,
  RouteConfigToTypedResponse<R> | Response | Promise<Response> | void | Promise<void>
>

export class OpenAPIHono<
  E extends Env = Env,
  S extends Schema = {},
  BasePath extends string = '/'
> extends Hono<E, S, BasePath> {
  openapiRoutes: OpenAPIRoute[] = []
  defaultHook?: OpenAPIHonoOptions<E>['defaultHook']

  constructor(init?: HonoInit<E>) {
    super(init)
    this.defaultHook = init?.defaultHook
  }

  openapi<
    R extends OpenAPIRoute,
    I extends Input = InputTypeParam<R> &
      InputTypeQuery<R> &
      InputTypeHeader<R> &
      InputTypeCookie<R> &
      InputTypeForm<R> &
      InputTypeJson<R>,
    P extends string = ConvertPathType<R['path']>
  >(
    { middleware: routeMiddleware, ...route }: R,
    handler: Handler<
      E,
      P,
      I,
      // If response type is defined, only TypedResponse is allowed.
      R extends {
        responses: {
          [statusCode: number]: {
            content: {
              [mediaType: string]: ContentTypeObject
            }
          }
        }
      }
        ? MaybePromise<RouteConfigToTypedResponse<R>>
        : MaybePromise<RouteConfigToTypedResponse<R>> | MaybePromise<Response>
    >,
    hook:
      | Hook<
          I,
          E,
          P,
          R extends {
            responses: {
              [statusCode: number]: {
                content: {
                  [mediaType: string]: ContentTypeObject
                }
              }
            }
          }
            ? MaybePromise<RouteConfigToTypedResponse<R>> | undefined
            : MaybePromise<RouteConfigToTypedResponse<R>> | MaybePromise<Response> | undefined
        >
      | undefined = this.defaultHook
  ): OpenAPIHono<
    E,
    S & ToSchema<R['method'], MergePath<BasePath, P>, I, RouteConfigToTypedResponse<R>>,
    BasePath
  > {
    this.openapiRoutes.push(route)

    const validators: MiddlewareHandler[] = []

    if (route.request?.query) {
      const validator = tbValidator('query', route.request.query, hook as any)
      validators.push(validator)
    }

    if (route.request?.params) {
      const validator = tbValidator('param', route.request.params, hook as any)
      validators.push(validator)
    }

    if (route.request?.headers) {
      const validator = tbValidator('header', route.request.headers, hook as any)
      validators.push(validator)
    }

    if (route.request?.cookies) {
      const validator = tbValidator('cookie', route.request.cookies, hook as any)
      validators.push(validator)
    }

    const bodyContent = route.request?.body?.content

    if (bodyContent) {
      for (const mediaType of Object.keys(bodyContent)) {
        if (!bodyContent[mediaType]) {
          continue
        }
        const schema = (bodyContent[mediaType] as ContentTypeObject).schema
        if (isJSONContentType(mediaType)) {
          const validator = tbValidator('json', schema, hook as any)
          validators.push(validator)
        }
        if (isFormContentType(mediaType)) {
          const validator = tbValidator('form', schema, hook as any)
          validators.push(validator)
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
      route.path.replaceAll(/\/{(.+?)}/g, '/:$1'),
      ...middleware,
      ...validators,
      handler
    )
    return this
  }

  getOpenAPIDocument = (config: OpenDocsConfig): OpenAPIV3_1.Document => {
    const { documentation } = config
    const schema: {
      paths: Record<string, any>
      schemas: Record<string, any>
    } = {
      paths: {},
      schemas: {},
    }

    for (const route of this.openapiRoutes) {
      if (route.detail?.hide) {
        continue
      }
      if (config.excludeMethods?.includes(route.method)) {
        continue
      }

      registerSchemaPath({
        route,
        schema,
        method: route.method,
        path: route.path,
      })
    }

    const { securitySchemes, ...rest } = documentation

    const document = {
      ...rest,
      tags: documentation.tags?.filter((tag) => !config.excludeTags?.includes(tag?.name)),
      paths: {
        ...schema.paths,
      },
      components: {
        schemas: schema.schemas,
        securitySchemes,
      },
    } satisfies OpenAPIV3_1.Document

    // @ts-expect-error the _basePath is a private property
    return this._basePath !== '/'
      ? // @ts-expect-error the _basePath is a private property
        addBasePathToDocument(document, this._basePath)
      : document
  }

  doc = <P extends string = '/openapi.json'>(
    path: P,
    config: OpenDocsConfig = {
      documentation: {
        openapi: '3.1.0',
        info: {
          title: 'Hono OpenAPI',
          version: '0.0.1',
        },
      },
      excludeMethods: ['OPTIONS'],
    }
  ): OpenAPIHono<E, S & ToSchema<'get', P, {}, {}>, BasePath> => {
    return this.get(path, (c) => {
      try {
        const document = this.getOpenAPIDocument(config)
        return c.json(document)
      } catch (e: any) {
        return c.json(e, 500)
      }
    }) as any
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
    const pathForOpenAPI = path.replaceAll(/:([^\/]+)/g, '{$1}')
    super.route(path, app as any)

    if (!(app instanceof OpenAPIHono)) {
      return this as any
    }

    for (const route of app.openapiRoutes) {
      this.openapiRoutes.push({
        ...route,
        path: mergePath(pathForOpenAPI, route.path),
      })
    }

    return this
  }

  basePath<SubPath extends string>(path: SubPath): OpenAPIHono<E, S, MergePath<BasePath, SubPath>> {
    return new OpenAPIHono({
      ...(super.basePath(path) as any),
      defaultHook: this.defaultHook,
    })
  }
}

type RoutingPath<P extends string> = P extends `${infer Head}/{${infer Param}}${infer Tail}`
  ? `${Head}/:${Param}${RoutingPath<Tail>}`
  : P

export function createRoute<P extends string, R extends Omit<OpenAPIRoute, 'path'> & { path: P }>(
  routeConfig: R
) {
  const route = {
    ...routeConfig,
    getRoutingPath(): RoutingPath<R['path']> {
      return routeConfig.path.replaceAll(/\/{(.+?)}/g, '/:$1') as RoutingPath<P>
    },
  }
  return Object.defineProperty(route, 'getRoutingPath', { enumerable: false })
}

function addBasePathToDocument(document: Record<string, any>, basePath: string) {
  const updatedPaths: Record<string, any> = {}
  if (!document.paths) {
    return document
  }

  for (const path of Object.keys(document.paths)) {
    updatedPaths[mergePath(basePath, path)] = document.paths[path]
  }

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
