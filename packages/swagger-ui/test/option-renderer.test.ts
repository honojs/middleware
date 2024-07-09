/*eslint quotes: ["off", "single"]*/

import { renderSwaggerUIOptions } from '../src/swagger/renderer'

describe('SwaggerUIOption Rendering', () => {
  it('renders correctly with configUrl', () =>
    expect(
      renderSwaggerUIOptions({
        configUrl: 'https://petstore3.swagger.io/api/v3/openapi.json',
      })
    ).toEqual("configUrl: 'https://petstore3.swagger.io/api/v3/openapi.json'"))

  it('renders correctly with presets', () =>
    expect(
      renderSwaggerUIOptions({
        presets: ['SwaggerUIBundle.presets.apis', 'SwaggerUIStandalonePreset'],
      })
    ).toEqual('presets: [SwaggerUIBundle.presets.apis,SwaggerUIStandalonePreset]'))

  it('renders correctly with plugins', () =>
    expect(
      renderSwaggerUIOptions({
        plugins: ['SwaggerUIBundle.plugins.DownloadUrl'],
      })
    ).toEqual('plugins: [SwaggerUIBundle.plugins.DownloadUrl]'))

  it('renders correctly with deepLinking', () =>
    expect(
      renderSwaggerUIOptions({
        deepLinking: true,
      })
    ).toEqual('deepLinking: true'))

  it('renders correctly with spec', () =>
    expect(
      renderSwaggerUIOptions({
        spec: {
          openapi: '3.0.0',
          info: {
            title: 'Swagger Petstore',
            version: '1.0.0',
          },
          servers: [
            {
              url: 'https://petstore3.swagger.io/api/v3',
            },
          ],
        },
      })
    ).toEqual(
      'spec: {"openapi":"3.0.0","info":{"title":"Swagger Petstore","version":"1.0.0"},"servers":[{"url":"https://petstore3.swagger.io/api/v3"}]}'
    ))

  it('renders correctly with url', () => {
    expect(
      renderSwaggerUIOptions({
        url: 'https://petstore3.swagger.io/api/v3/openapi.json',
      })
    ).toEqual("url: 'https://petstore3.swagger.io/api/v3/openapi.json'")
  })

  it('renders correctly with urls', () => {
    expect(
      renderSwaggerUIOptions({
        urls: [
          {
            name: 'Petstore',
            url: 'https://petstore3.swagger.io/api/v3/openapi.json',
          },
        ],
      })
    ).toEqual(
      'urls: [{"name":"Petstore","url":"https://petstore3.swagger.io/api/v3/openapi.json"}]'
    )
  })

  it('renders correctly with layout', () =>
    expect(
      renderSwaggerUIOptions({
        layout: 'StandaloneLayout',
      })
    ).toEqual("layout: 'StandaloneLayout'"))

  it('renders correctly with docExpansion', () =>
    expect(
      renderSwaggerUIOptions({
        docExpansion: 'list',
      })
    ).toEqual("docExpansion: 'list'"))

  it('renders correctly with maxDisplayedTags', () =>
    expect(
      renderSwaggerUIOptions({
        maxDisplayedTags: 5,
      })
    ).toEqual('maxDisplayedTags: 5'))

  it('renders correctly with operationsSorter', () =>
    expect(
      renderSwaggerUIOptions({
        operationsSorter: '(a, b) => a.path.localeCompare(b.path)',
      })
    ).toEqual('operationsSorter: (a, b) => a.path.localeCompare(b.path)'))

  it('renders correctly with requestInterceptor', () =>
    expect(
      renderSwaggerUIOptions({
        requestInterceptor: '(req) => req',
      })
    ).toEqual('requestInterceptor: (req) => req'))

  it('renders correctly with responseInterceptor', () =>
    expect(
      renderSwaggerUIOptions({
        responseInterceptor: '(res) => res',
      })
    ).toEqual('responseInterceptor: (res) => res'))

  it('renders correctly with persistAuthorization', () =>
    expect(
      renderSwaggerUIOptions({
        persistAuthorization: true,
      })
    ).toEqual('persistAuthorization: true'))

  it('renders correctly with defaultModelsExpandDepth', () =>
    expect(
      renderSwaggerUIOptions({
        defaultModelsExpandDepth: 1,
      })
    ).toEqual('defaultModelsExpandDepth: 1'))

  it('renders correctly with defaultModelExpandDepth', () =>
    expect(
      renderSwaggerUIOptions({
        defaultModelExpandDepth: 2,
      })
    ).toEqual('defaultModelExpandDepth: 2'))

  it('renders correctly with defaultModelRendering', () =>
    expect(
      renderSwaggerUIOptions({
        defaultModelRendering: 'model',
      })
    ).toEqual("defaultModelRendering: 'model'"))

  it('renders correctly with displayRequestDuration', () =>
    expect(
      renderSwaggerUIOptions({
        displayRequestDuration: true,
      })
    ).toEqual('displayRequestDuration: true'))
  
  it('renders correctly with filter', () =>
    expect(
      renderSwaggerUIOptions({
        filter: true,
      })
    ).toEqual('filter: true'))

  it('renders correctly with showExtensions', () =>
    expect(
      renderSwaggerUIOptions({
        showExtensions: true,
      })
    ).toEqual('showExtensions: true'))

  it('renders correctly with showCommonExtensions', () =>
    expect(
      renderSwaggerUIOptions({
        showCommonExtensions: true,
      })
    ).toEqual('showCommonExtensions: true'))
})
