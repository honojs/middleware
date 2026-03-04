import { remoteAssets } from './swagger/resource'

describe('remoteAssets', () => {
  it('should return default assets when no version is provided', () => {
    const assets = remoteAssets({})
    expect(assets.css).toEqual(['https://cdn.jsdelivr.net/npm/swagger-ui-dist/swagger-ui.css'])
    expect(assets.js).toEqual(['https://cdn.jsdelivr.net/npm/swagger-ui-dist/swagger-ui-bundle.js'])
  })

  it('should return assets with version when version is provided', () => {
    const version = '1.2.3'
    const assets = remoteAssets({ version })
    expect(assets.css).toEqual([
      `https://cdn.jsdelivr.net/npm/swagger-ui-dist@${version}/swagger-ui.css`,
    ])
    expect(assets.js).toEqual([
      `https://cdn.jsdelivr.net/npm/swagger-ui-dist@${version}/swagger-ui-bundle.js`,
    ])
  })

  it('should use custom baseUrl for internal CDN', () => {
    const baseUrl = 'https://unpkg.com'
    const assets = remoteAssets({ baseUrl })
    expect(assets.css).toEqual([`${baseUrl}/swagger-ui-dist/swagger-ui.css`])
    expect(assets.js).toEqual([`${baseUrl}/swagger-ui-dist/swagger-ui-bundle.js`])
  })

  it('should support baseUrl with version', () => {
    const baseUrl = 'https://unpkg.com'
    const version = '5.0.0'
    const assets = remoteAssets({ baseUrl, version })
    expect(assets.css).toEqual([`${baseUrl}/swagger-ui-dist@${version}/swagger-ui.css`])
    expect(assets.js).toEqual([`${baseUrl}/swagger-ui-dist@${version}/swagger-ui-bundle.js`])
  })
})
