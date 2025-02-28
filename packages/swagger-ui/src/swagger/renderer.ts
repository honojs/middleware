import type { SwaggerConfigs } from 'swagger-ui-dist'

type RequireOne<T, K extends keyof T = keyof T> = K extends keyof T ? PartialRequire<T, K> : never
type PartialRequire<O, K extends keyof O> = {
  [P in K]-?: O[P]
} & O

export type DistSwaggerUIOptions = {
  configUrl?: SwaggerConfigs['configUrl']
  deepLinking?: SwaggerConfigs['deepLinking']
  presets?: string[]
  plugins?: string[]
  spec?: SwaggerConfigs['spec']
  layout?: SwaggerConfigs['layout']
  docExpansion?: SwaggerConfigs['docExpansion']
  maxDisplayedTags?: SwaggerConfigs['maxDisplayedTags']
  /**
   * accepts function as a string.
   *
   * @example (a, b) => a.path.localeCompare(b.path)
   */
  operationsSorter?: string
  /**
   * accepts function as a string.
   *
   * @example (req) => req
   */
  requestInterceptor?: string
  /**
   * accepts function as a string.
   *
   * @example (res) => res
   */
  responseInterceptor?: string
  persistAuthorization?: boolean
  defaultModelsExpandDepth?: number
  defaultModelExpandDepth?: number
  defaultModelRendering?: 'example' | 'model' | undefined
  displayRequestDuration?: boolean
  filter?: boolean | string
  showExtensions?: boolean
  showCommonExtensions?: boolean
  queryConfigEnabled?: boolean
  displayOperationId?: boolean
  /**
   * accepts function as a string.
   * swagger-ui accepts alpha in the tagsSorter, but this middleware does not support it.
   *
   * @example (a, b) => a.name.localeCompare(b.name)
   */
  tagsSorter?: string
  /**
   * accepts function as a string.
   * @example () => { console.log('Swagger UI Loaded'); }
   */
  onComplete?: string
  syntaxHighlight?: boolean | { activated: boolean; theme: string[] }
  tryItOutEnabled?: boolean
  requestSnippetsEnabled?: boolean
  requestSnippets?: object
  oauth2RedirectUrl?: string
  showMutabledRequest?: boolean
  request?: {
    curlOptions?: string[]
  }
  supportedSubmitMethods?: string[]
  validatorUrl?: string
  withCredentials?: boolean
  modelPropertyMacro?: string
  parameterMacro?: string
} & RequireOne<{
  url?: SwaggerConfigs['url']
  urls?: SwaggerConfigs['urls']
}> // least one of `url` or `urls` is required because the output html will be broken if both are missing

const RENDER_TYPE = {
  STRING_ARRAY: 'string_array',
  STRING: 'string',
  JSON_STRING: 'json_string',
  RAW: 'raw',
} as const

const RENDER_TYPE_MAP = {
  configUrl: RENDER_TYPE.STRING,
  deepLinking: RENDER_TYPE.RAW,
  presets: RENDER_TYPE.STRING_ARRAY,
  plugins: RENDER_TYPE.STRING_ARRAY,
  spec: RENDER_TYPE.JSON_STRING,
  url: RENDER_TYPE.STRING,
  urls: RENDER_TYPE.JSON_STRING,
  layout: RENDER_TYPE.STRING,
  docExpansion: RENDER_TYPE.STRING,
  maxDisplayedTags: RENDER_TYPE.RAW,
  operationsSorter: RENDER_TYPE.RAW,
  requestInterceptor: RENDER_TYPE.RAW,
  responseInterceptor: RENDER_TYPE.RAW,
  persistAuthorization: RENDER_TYPE.RAW,
  defaultModelsExpandDepth: RENDER_TYPE.RAW,
  defaultModelExpandDepth: RENDER_TYPE.RAW,
  defaultModelRendering: RENDER_TYPE.STRING,
  displayRequestDuration: RENDER_TYPE.RAW,
  filter: RENDER_TYPE.RAW,
  showExtensions: RENDER_TYPE.RAW,
  showCommonExtensions: RENDER_TYPE.RAW,
  queryConfigEnabled: RENDER_TYPE.RAW,
  displayOperationId: RENDER_TYPE.RAW,
  tagsSorter: RENDER_TYPE.RAW,
  onComplete: RENDER_TYPE.RAW,
  syntaxHighlight: RENDER_TYPE.JSON_STRING,
  tryItOutEnabled: RENDER_TYPE.RAW,
  requestSnippetsEnabled: RENDER_TYPE.RAW,
  requestSnippets: RENDER_TYPE.JSON_STRING,
  oauth2RedirectUrl: RENDER_TYPE.STRING,
  showMutabledRequest: RENDER_TYPE.RAW,
  request: RENDER_TYPE.JSON_STRING,
  supportedSubmitMethods: RENDER_TYPE.JSON_STRING,
  validatorUrl: RENDER_TYPE.STRING,
  withCredentials: RENDER_TYPE.RAW,
  modelPropertyMacro: RENDER_TYPE.RAW,
  parameterMacro: RENDER_TYPE.RAW,
} as const satisfies Record<
  keyof DistSwaggerUIOptions,
  (typeof RENDER_TYPE)[keyof typeof RENDER_TYPE]
>

export const renderSwaggerUIOptions = (options: DistSwaggerUIOptions) => {
  const optionsStrings = Object.entries(options)
    .map(([k, v]) => {
      const key = k as keyof typeof RENDER_TYPE_MAP

      if (!RENDER_TYPE_MAP[key] || v === undefined) {
        return ''
      }

      switch (RENDER_TYPE_MAP[key]) {
        case RENDER_TYPE.STRING:
          return `${key}: '${v}'`
        case RENDER_TYPE.STRING_ARRAY:
          if (!Array.isArray(v)) {
            return ''
          }
          return `${key}: [${v.map((ve) => `${ve}`).join(',')}]`
        case RENDER_TYPE.JSON_STRING:
          return `${key}: ${JSON.stringify(v)}`
        case RENDER_TYPE.RAW:
          return `${key}: ${v}`
        default:
          return ''
      }
    })
    .filter(item => item !== '')
    .join(',')

  return optionsStrings
}
