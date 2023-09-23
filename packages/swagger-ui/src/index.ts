import type { MiddlewareHandler } from 'hono'

export interface SwaggerUIOptions {
  /**
   * The path to get openapi doc from.
   * @default '/openapi.json'
   * @example
   * ```ts
   * app.use('/docs', swaggerUI({ docPath: '/api/openapi.json' }))
   * ```
   */
  docPath?: string
  /**
   * The version of Swagger UI. See https://www.npmjs.com/package/swagger-ui-dist.
   * @default 'latest'
   */
  version?: string
}

/**
 * Returns a middleware that serves Swagger UI.
 * Using `swagger-ui-dist` from CDN by default.
 * @param options The options.
 * @example
 * ```ts
 * app.use('/docs', swaggerUI())
 * ```
 */
export function swaggerUI(options: SwaggerUIOptions = {}): MiddlewareHandler {
  const { docPath = '/openapi.json', version = 'latest' } = options

  return async (c) =>
    c.html(`
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>Swagger UI</title>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@${version}/swagger-ui-bundle.min.js"></script>
    <link href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@${version}/swagger-ui.min.css" rel="stylesheet">
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script>
      window.onload = function() {
        SwaggerUIBundle({
          url: '${docPath}',
          dom_id: '#swagger-ui',
          presets: [
            SwaggerUIBundle.presets.apis,
            SwaggerUIBundle.SwaggerUIStandalonePreset
          ],
        })
      }
    </script>
  </body>
</html>
`)
}
