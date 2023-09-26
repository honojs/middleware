import type { Env, MiddlewareHandler } from 'hono'
import { html } from 'hono/html'
import { remoteAssets } from './swagger/resource'

type ResourceOptions = {
  version?: string
}

type SwaggerUIOptions = {
  url: string
  ui?: ResourceOptions
}

const SwaggerUI = (options: SwaggerUIOptions) => {
  const asset = remoteAssets({ version: options?.ui?.version })

  return html`
    <div>
      <div id="swagger-ui"></div>
      ${asset.css.map((url) => html`<link rel="stylesheet" href="${url}" />`)}
      ${asset.js.map((url) => html`<script src="${url}" crossorigin="anonymous"></script>`)}
      <script>
        window.onload = () => {
          window.ui = SwaggerUIBundle({
            url: '${options.url}',
            dom_id: '#swagger-ui',
          })
        }
      </script>
    </div>
  `
}

const middleware =
  <E extends Env>(options: SwaggerUIOptions): MiddlewareHandler<E> =>
  async (c) => {
    return c.html(html`
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
