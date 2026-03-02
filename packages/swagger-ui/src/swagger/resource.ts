export interface AssetURLs {
  css: string[]
  js: string[]
}

const DEFAULT_CDN_BASE = 'https://cdn.jsdelivr.net/npm'

type ResourceConfig = {
  /** CDN base URL, e.g. https://unpkg.com for internal network mirror */
  baseUrl?: string
  version?: string
}

export const remoteAssets = ({
  baseUrl = DEFAULT_CDN_BASE,
  version,
}: ResourceConfig): AssetURLs => {
  const url = `${baseUrl.replace(/\/$/, '')}/swagger-ui-dist${
    version !== undefined ? `@${version}` : ''
  }`

  return {
    css: [`${url}/swagger-ui.css`],
    js: [`${url}/swagger-ui-bundle.js`],
  }
}
