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
  css?: string[]
  cssUrl?: string[]
  js?: string[]
  jsUrl?: string[]
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
        {options?.css?.map((content) => (
          <style dangerouslySetInnerHTML={{ __html: content }} />
        ))}
        {options?.cssUrl?.map((url) => (
          <style rel='stylesheet' href={url} />
        ))}

        {asset.js.map((url) => (
          <script src={url} crossorigin />
        ))}
        {options?.js?.map((content) => (
          <script dangerouslySetInnerHTML={{ __html: content }} />
        ))}
        {options?.jsUrl?.map((url) => (
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
  async (c) => {
    return c.html(<SwaggerUI {...options} />)
  }

export { middleware as swaggerUI, SwaggerUI }
