/** @jsxImportSource hono/jsx */

import type { OpenAPIObject } from 'openapi3-ts/oas30'
import { buildUIScript } from './build-ui-script'
import { remoteAssets } from './resource'

type Props = {
  title?: string
  ui?: {
    version?: string
  }
} & (
  | {
      url: string
    }
  | {
      spec: OpenAPIObject
    }
)

export const SwaggerUI = ({ title = 'SwaggerUI', ui, ...config }: Props) => {
  const asset = remoteAssets({ version: ui?.version })
  const script = buildUIScript({ ...config, domId: 'swagger-ui' })

  return (
    <html lang='en'>
      <head>
        <meta charset='utf-8' />
        <meta name='viewport' content='width=device-width, initial-scale=1' />
        <meta name='description' content='SwaggerUI' />
        <title>{title}</title>

        {asset.css.map((url) => (
          <link rel='stylesheet' href={url} />
        ))}
        {asset.js.map((url) => (
          <script src={url} crossorigin />
        ))}
      </head>
      <body>
        <div id='swagger-ui'></div>
        <script dangerouslySetInnerHTML={{ __html: script }} />
      </body>
    </html>
  )
}
