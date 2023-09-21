/** @jsxImportSource hono/jsx */
import { Hono } from 'hono'
import type { OpenAPIObject } from 'openapi3-ts/oas30'
// eslint-disable-next-line node/no-extraneous-import
import { describe, it, expect, beforeEach } from 'vitest'
import { SwaggerUI } from '../src'
import { buildUIScript } from '../src/swagger/build-ui-script'
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

describe('buildUIScript Function', () => {
  it('should generate the correct script when domId and url are provided', () => {
    const result = buildUIScript({ domId: 'swagger-ui', url: 'http://example.com' })
    const expectedScript = `
    window.onload = () => {
      window.ui = SwaggerUIBundle({"url":"http://example.com","dom_id":"#swagger-ui"});
    };
  `
    expect(result).toBe(expectedScript)
  })

  it('should generate the correct script when domId and spec are provided', () => {
    const spec: OpenAPIObject = {
      openapi: '3.0.0',
      info: {
        title: 'Test API',
        version: '1.0.0',
      },
      paths: {},
    }
    const result = buildUIScript({ domId: 'swagger-ui', spec })
    const expectedScript = `
    window.onload = () => {
      window.ui = SwaggerUIBundle({"spec":${JSON.stringify(spec)},"dom_id":"#swagger-ui"});
    };
  `
    expect(result).toBe(expectedScript)
  })
})

describe('SwaggerUI Component', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
  })

  it.each([
    [{}, 'with default props'],
    [{ title: 'title' }, 'with custom title'],
    [{ ui: { version: '5.7.2' } }, 'with custom UI version'],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ])('should render correctly %s', async (props, _) => {
    app.get('/', (c) => {
      return c.html(<SwaggerUI url='https://petstore3.swagger.io/api/v3/openapi.json' {...props} />)
    })

    const res = await app.request('/')
    const html = await res.text()
    expect(html).toMatchSnapshot()
  })
})
