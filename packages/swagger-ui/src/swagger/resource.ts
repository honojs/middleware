export interface AssetURLs {
  css: string[]
  js: string[]
}

const DEFAULT_CDN_BASE = 'https://cdn.jsdelivr.net/npm'

type ResourceConfig = {
  /** CDN base URL, e.g. https://unpkg.com for internal network mirror */
  baseUrl?: string
  version?: string
  /** Also load `swagger-ui-standalone-preset.js`, which provides `SwaggerUIStandalonePreset` */
  standalonePreset?: boolean
}

export const remoteAssets = ({
  baseUrl = DEFAULT_CDN_BASE,
  version,
  standalonePreset = false,
}: ResourceConfig): AssetURLs => {
  const url = `${baseUrl.replace(/\/$/, '')}/swagger-ui-dist${
    version !== undefined ? `@${version}` : ''
  }`

  const js = [`${url}/swagger-ui-bundle.js`]
  if (standalonePreset) {
    js.push(`${url}/swagger-ui-standalone-preset.js`)
  }

  return {
    css: [`${url}/swagger-ui.css`],
    js,
  }
}
