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

  it('renders correctly with queryConfigEnabled', () =>
    expect(
      renderSwaggerUIOptions({
        queryConfigEnabled: true,
      })
    ).toEqual('queryConfigEnabled: true'))

  it('renders correctly with displayOperationId', () =>
    expect(
      renderSwaggerUIOptions({
        displayOperationId: true,
      })
    ).toEqual('displayOperationId: true'))

  it('renders correctly with tagsSorter', () =>
    expect(
      renderSwaggerUIOptions({
        tagsSorter: '(a, b) => a.name.localeCompare(b.name)',
      })
    ).toEqual('tagsSorter: (a, b) => a.name.localeCompare(b.name)'))

  it('renders correctly with useUnsafeMarkdown', () =>
    expect(
      renderSwaggerUIOptions({
        useUnsafeMarkdown: true,
      })
    ).toEqual('useUnsafeMarkdown: true'))

  it('renders correctly with onComplete', () =>
    expect(
      renderSwaggerUIOptions({
        onComplete: '() => console.log("Completed")',
      })
    ).toEqual('onComplete: () => console.log("Completed")'))

  it('renders correctly with syntaxHighlight as false', () =>
    expect(
      renderSwaggerUIOptions({
        syntaxHighlight: false,
      })
    ).toEqual('syntaxHighlight: false'))

  it('renders correctly with syntaxHighlight as object', () =>
    expect(
      renderSwaggerUIOptions({
        syntaxHighlight: { activated: true, theme: ['agate', 'arta'] },
      })
    ).toEqual('syntaxHighlight: {"activated":true,"theme":["agate","arta"]}'))

  it('renders correctly with tryItOutEnabled', () =>
    expect(
      renderSwaggerUIOptions({
        tryItOutEnabled: true,
      })
    ).toEqual('tryItOutEnabled: true'))

  it('renders correctly with requestSnippets', () =>
    expect(
      renderSwaggerUIOptions({
        requestSnippets: { generators: { curl_bash: { title: 'cURL (bash)' } } },
      })
    ).toEqual('requestSnippets: {"generators":{"curl_bash":{"title":"cURL (bash)"}}}'))

  it('renders correctly with oauth2RedirectUrl', () =>
    expect(
      renderSwaggerUIOptions({
        oauth2RedirectUrl: 'https://example.com/oauth2-redirect.html',
      })
    ).toEqual("oauth2RedirectUrl: 'https://example.com/oauth2-redirect.html'"))

  it('renders correctly with showMutableRequest', () =>
    expect(
      renderSwaggerUIOptions({
        showMutableRequest: true,
      })
    ).toEqual('showMutableRequest: true'))

  it('renders correctly with request', () =>
    expect(
      renderSwaggerUIOptions({
        request: { curlOptions: ['--insecure'] },
      })
    ).toEqual('request: {"curlOptions":["--insecure"]}'))

  it('renders correctly with supportedSubmitMethods', () =>
    expect(
      renderSwaggerUIOptions({
        supportedSubmitMethods: ['get', 'post', 'put'],
      })
    ).toEqual('supportedSubmitMethods: [get,post,put]'))

  it('renders correctly with validatorUrl', () =>
    expect(
      renderSwaggerUIOptions({
        validatorUrl: 'https://validator.swagger.io',
      })
    ).toEqual("validatorUrl: 'https://validator.swagger.io'"))

  it('renders correctly with withCredentials', () =>
    expect(
      renderSwaggerUIOptions({
        withCredentials: true,
      })
    ).toEqual('withCredentials: true'))

  it('renders correctly with modelPropertyMacro', () =>
    expect(
      renderSwaggerUIOptions({
        modelPropertyMacro: '(property) => property',
      })
    ).toEqual('modelPropertyMacro: (property) => property'))

  it('renders correctly with parameterMacro', () =>
    expect(
      renderSwaggerUIOptions({
        parameterMacro: '(parameter) => parameter',
      })
    ).toEqual('parameterMacro: (parameter) => parameter'))
})
