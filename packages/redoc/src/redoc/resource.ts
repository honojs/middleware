export interface AssetURLs {
  css: string[]
  js: string[]
}

type ResourceConfig = {
  version?: string
}

export const remoteAssets = ({ version }: ResourceConfig = {}): AssetURLs => {
  const url = `https://cdn.jsdelivr.net/npm/redoc${
    version !== undefined ? `@${version}` : ''
  }`

  return {
    css: [],
    js: [`${url}/bundles/redoc.standalone.js`],
  }
}
