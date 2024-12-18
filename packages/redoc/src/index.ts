import type { Env, MiddlewareHandler } from 'hono'
import type { RedocRawOptions } from 'redoc'
import { renderRedocOptions } from './redoc/renderer'
import type { AssetURLs } from './redoc/resource'
import { remoteAssets } from './redoc/resource'

type OriginalRedocOptions = {
  version?: string
  /**
   * manuallyRedocHtml is a function that returns a string to customize the ReDoc HTML.
   * All options except for the version are ignored.
   *
   * @example
   * const redocUI = RedocUI({
   *   manuallyRedocHtml: (asset) => `
   *     <div>
   *       <script src="${asset.js[0]}" crossorigin="anonymous"></script>
   *       <div id="redoc-container"></div>
   *       <script>
   *         Redoc.init('https://petstore.swagger.io/v2/swagger.json', {}, document.getElementById('redoc-container'));
   *       </script>
   *     </div>
   *   `,
   * })
   */

  manuallyReDocHtml?: (asset: AssetURLs) => string
  title?: string
}

type RedocOptions = OriginalRedocOptions &
  RedocRawOptions & {
    url: string
  }

const ReDoc = (options: RedocOptions): string => {
  const asset = remoteAssets({ version: options?.version })
  delete options.version

  if (options.manuallyReDocHtml) {
    return options.manuallyReDocHtml(asset)
  }

  const optionsStrings = renderRedocOptions(options)

  return `
    <div>
      <script src="${asset.js[0]}" crossorigin="anonymous"></script>
      <div id="redoc-container"></div>
      <script>
        Redoc.init('${options.url}', {${optionsStrings}}, document.getElementById('redoc-container'));
      </script>
    </div>
  `
}

const middleware =
  <E extends Env>(options: RedocOptions): MiddlewareHandler<E> =>
  async (c) => {
    const title = options?.title ?? 'ReDoc'
    return c.html(/* html */ `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="description" content="ReDoc" />
          <title>${title}</title>
        </head>
        <body>
          ${ReDoc(options)}
        </body>
      </html>
    `)
  }

export { middleware as redoc, ReDoc }
export { RedocOptions }
