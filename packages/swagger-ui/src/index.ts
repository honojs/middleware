import type { Env, MiddlewareHandler } from 'hono'
import { html } from 'hono/html'
import type { DistSwaggerUIOptions } from './swagger/renderer'
import { renderSwaggerUIOptions } from './swagger/renderer'
import type { AssetURLs } from './swagger/resource'
import { remoteAssets } from './swagger/resource'

type OriginalSwaggerUIOptions = {
  version?: string
  /**
   * manuallySwaggerUIHtml is a string that is used to render SwaggerUI.
   * If this is set, all other options will be ignored except version.
   * The string will be inserted into the body of the HTML.
   * This is useful when you want to fully customize the UI.
   *
   * @example
   * ```ts
   * const swaggerUI = SwaggerUI({
   *   manuallySwaggerUIHtml: (asset) => `
   *   <div>
   *     <div id="swagger-ui"></div>
   *     ${asset.css.map((url) => `<link rel="stylesheet" href="${url}" />`)}
   *     ${asset.js.map((url) => `<script src="${url}" crossorigin="anonymous"></script>`)}
   *     <script>
   *       window.onload = () => {
   *         window.ui = SwaggerUIBundle({
   *           dom_id: '#swagger-ui',
   *           url: 'https://petstore.swagger.io/v2/swagger.json',
   *         })
   *       }
   *     </script>
   *   </div>
   *   `,
   * })
   * ```
   */
  manuallySwaggerUIHtml?: (asset: AssetURLs) => string
}

type SwaggerUIOptions = OriginalSwaggerUIOptions & DistSwaggerUIOptions

const SwaggerUI = (options: SwaggerUIOptions) => {
  const asset = remoteAssets({ version: options?.version })
  delete options.version

  if (options.manuallySwaggerUIHtml) {
    return options.manuallySwaggerUIHtml(asset)
  }

  const optionsStrings = renderSwaggerUIOptions(options)

  return `
    <div>
      <div id="swagger-ui"></div>
      ${asset.css.map((url) => html`<link rel="stylesheet" href="${url}" />`)}
      ${asset.js.map((url) => html`<script src="${url}" crossorigin="anonymous"></script>`)}
      <script>
        window.onload = () => {
          window.ui = SwaggerUIBundle({
            dom_id: '#swagger-ui',${optionsStrings},
          })
        }
      </script>
    </div>
  `
}

const middleware =
  <E extends Env>(options: SwaggerUIOptions): MiddlewareHandler<E> =>
  async (c) => {
    return c.html(/* html */ `
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="description" content="SwaggerUI" />
          <title>SwaggerUI</title>
        </head>
        <body>
          ${SwaggerUI(options)}
        </body>
      </html>
    `)
  }

export { middleware as swaggerUI, SwaggerUI }
export { SwaggerUIOptions }
