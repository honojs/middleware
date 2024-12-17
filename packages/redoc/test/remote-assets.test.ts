import { remoteAssets } from '../src/redoc/resource'

describe('remoteAssets', () => {
  it('should return default assets when no version is provided', () => {
    const assets = remoteAssets({})
    expect(assets.js).toEqual(['https://cdn.jsdelivr.net/npm/redoc/bundles/redoc.standalone.js'])
  })

  it('should return assets with version when version is provided', () => {
    const version = '2.2.0'
    const assets = remoteAssets({ version })
    expect(assets.js).toEqual([
      `https://cdn.jsdelivr.net/npm/redoc@${version}/bundles/redoc.standalone.js`,
    ])
  })
})
