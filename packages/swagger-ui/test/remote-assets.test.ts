import { remoteAssets } from '../src/swagger/resource'

describe('remoteAssets', () => {
  it('should return default assets when no version is provided', () => {
    const assets = remoteAssets({})
    expect(assets.css).toEqual(['https://unpkg.com/swagger-ui-dist/swagger-ui.css'])
    expect(assets.js).toEqual(['https://unpkg.com/swagger-ui-dist/swagger-ui-bundle.js'])
  })

  it('should return assets with version when version is provided', () => {
    const version = '1.2.3'
    const assets = remoteAssets({ version })
    expect(assets.css).toEqual([`https://unpkg.com/swagger-ui-dist@${version}/swagger-ui.css`])
    expect(assets.js).toEqual([`https://unpkg.com/swagger-ui-dist@${version}/swagger-ui-bundle.js`])
  })
})
