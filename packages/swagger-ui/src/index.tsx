import type { Env, MiddlewareHandler } from 'hono'
import type { OpenAPIObject } from 'openapi3-ts/oas30'
import { buildUIScript } from './swagger/build-ui-script'
import { remoteAssets } from './swagger/resource'

export type SwaggerOptions =
  | {
      url: string
    }
  | {
      spec: OpenAPIObject
    }
type ResourceOptions = {
  version?: string
}

type Options = SwaggerOptions & {
  title?: string
  css?: string
  js?: string
  cssUrls?: string[]
  jsUrls?: string[]
  ui?: ResourceOptions
}

const SwaggerUI = (options: Options) => {
  const asset = remoteAssets({ version: options?.ui?.version })
  const script = buildUIScript({ ...options, domId: 'swagger-ui' })

  return (
    <html lang='en'>
      <head>
        <meta charset='utf-8' />
        <meta name='viewport' content='width=device-width, initial-scale=1' />
        <meta name='description' content='SwaggerUI' />
        <title>{options?.title ?? 'SwaggerUI'}</title>

        {asset.css.map((url) => (
          <link rel='stylesheet' href={url} />
        ))}
        {options?.css && (
          <style dangerouslySetInnerHTML={{ __html: options.css }} />
        )}
        {options?.cssUrls?.map((url) => (
          <style rel='stylesheet' href={url} />
        ))}

        {asset.js.map((url) => (
          <script src={url} crossorigin />
        ))}
        {options?.js && (
          <script dangerouslySetInnerHTML={{ __html: options.js }} />
        )}
        {options?.jsUrls?.map((url) => (
          <script src={url} crossorigin />
        ))}
      </head>
      <body>
        <div id='swagger-ui' />
        <script dangerouslySetInnerHTML={{ __html: script }} />
      </body>
    </html>
  )
}

const middleware =
  <E extends Env>(options: Options): MiddlewareHandler<E> =>
  async (c) => c.html(<SwaggerUI {...options} />)

export { middleware as swaggerUI, SwaggerUI }
