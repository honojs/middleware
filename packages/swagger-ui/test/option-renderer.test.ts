/*eslint quotes: ["off", "single"]*/

import { renderSwaggerUIOptions } from '../src/swagger/renderer'

describe('SwaggerUIOption Rendering', () => {
  it('renders correctly with configUrl', () =>
    expect(
      renderSwaggerUIOptions({
        configUrl: 'https://petstore3.swagger.io/api/v3/openapi.json',
        url: 'https://petstore3.swagger.io/api/v3/openapi.json',
      })
    ).toEqual(
      "configUrl: 'https://petstore3.swagger.io/api/v3/openapi.json',url: 'https://petstore3.swagger.io/api/v3/openapi.json'"
    ))

  it('renders correctly with presets', () =>
    expect(
      renderSwaggerUIOptions({
        presets: ['SwaggerUIBundle.presets.apis', 'SwaggerUIStandalonePreset'],
        url: 'https://petstore3.swagger.io/api/v3/openapi.json',
      })
    ).toEqual(
      "presets: [SwaggerUIBundle.presets.apis,SwaggerUIStandalonePreset],url: 'https://petstore3.swagger.io/api/v3/openapi.json'"
    ))

  it('renders correctly with plugins', () =>
    expect(
      renderSwaggerUIOptions({
        plugins: ['SwaggerUIBundle.plugins.DownloadUrl'],
        url: 'https://petstore3.swagger.io/api/v3/openapi.json',
      })
    ).toEqual(
      "plugins: [SwaggerUIBundle.plugins.DownloadUrl],url: 'https://petstore3.swagger.io/api/v3/openapi.json'"
    ))

  it('renders correctly with deepLinking', () =>
    expect(
      renderSwaggerUIOptions({
        deepLinking: true,
        url: 'https://petstore3.swagger.io/api/v3/openapi.json',
      })
    ).toEqual("deepLinking: true,url: 'https://petstore3.swagger.io/api/v3/openapi.json'"))

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
        url: 'https://petstore3.swagger.io/api/v3/openapi.json',
      })
    ).toEqual(
      'spec: {"openapi":"3.0.0","info":{"title":"Swagger Petstore","version":"1.0.0"},"servers":[{"url":"https://petstore3.swagger.io/api/v3"}]},url: \'https://petstore3.swagger.io/api/v3/openapi.json\''
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
        url: 'https://petstore3.swagger.io/api/v3/openapi.json',
      })
    ).toEqual("layout: 'StandaloneLayout',url: 'https://petstore3.swagger.io/api/v3/openapi.json'"))

  it('renders correctly with docExpansion', () =>
    expect(
      renderSwaggerUIOptions({
        docExpansion: 'list',
        url: 'https://petstore3.swagger.io/api/v3/openapi.json',
      })
    ).toEqual("docExpansion: 'list',url: 'https://petstore3.swagger.io/api/v3/openapi.json'"))

  it('renders correctly with maxDisplayedTags', () =>
    expect(
      renderSwaggerUIOptions({
        maxDisplayedTags: 5,
        url: 'https://petstore3.swagger.io/api/v3/openapi.json',
      })
    ).toEqual("maxDisplayedTags: 5,url: 'https://petstore3.swagger.io/api/v3/openapi.json'"))

  it('renders correctly with operationsSorter', () =>
    expect(
      renderSwaggerUIOptions({
        operationsSorter: '(a, b) => a.path.localeCompare(b.path)',
        url: 'https://petstore3.swagger.io/api/v3/openapi.json',
      })
    ).toEqual(
      "operationsSorter: (a, b) => a.path.localeCompare(b.path),url: 'https://petstore3.swagger.io/api/v3/openapi.json'"
    ))

  it('renders correctly with requestInterceptor', () =>
    expect(
      renderSwaggerUIOptions({
        requestInterceptor: '(req) => req',
        url: 'https://petstore3.swagger.io/api/v3/openapi.json',
      })
    ).toEqual(
      "requestInterceptor: (req) => req,url: 'https://petstore3.swagger.io/api/v3/openapi.json'"
    ))

  it('renders correctly with responseInterceptor', () =>
    expect(
      renderSwaggerUIOptions({
        responseInterceptor: '(res) => res',
        url: 'https://petstore3.swagger.io/api/v3/openapi.json',
      })
    ).toEqual(
      "responseInterceptor: (res) => res,url: 'https://petstore3.swagger.io/api/v3/openapi.json'"
    ))

  it('renders correctly with persistAuthorization', () =>
    expect(
      renderSwaggerUIOptions({
        persistAuthorization: true,
        url: 'https://petstore3.swagger.io/api/v3/openapi.json',
      })
    ).toEqual("persistAuthorization: true,url: 'https://petstore3.swagger.io/api/v3/openapi.json'"))

  it('renders correctly with defaultModelsExpandDepth', () =>
    expect(
      renderSwaggerUIOptions({
        defaultModelsExpandDepth: 1,
        url: 'https://petstore3.swagger.io/api/v3/openapi.json',
      })
    ).toEqual(
      "defaultModelsExpandDepth: 1,url: 'https://petstore3.swagger.io/api/v3/openapi.json'"
    ))

  it('renders correctly with defaultModelExpandDepth', () =>
    expect(
      renderSwaggerUIOptions({
        defaultModelExpandDepth: 2,
        url: 'https://petstore3.swagger.io/api/v3/openapi.json',
      })
    ).toEqual("defaultModelExpandDepth: 2,url: 'https://petstore3.swagger.io/api/v3/openapi.json'"))

  it('renders correctly with defaultModelRendering', () =>
    expect(
      renderSwaggerUIOptions({
        defaultModelRendering: 'model',
        url: 'https://petstore3.swagger.io/api/v3/openapi.json',
      })
    ).toEqual(
      "defaultModelRendering: 'model',url: 'https://petstore3.swagger.io/api/v3/openapi.json'"
    ))

  it('renders correctly with displayRequestDuration', () =>
    expect(
      renderSwaggerUIOptions({
        displayRequestDuration: true,
        url: 'https://petstore3.swagger.io/api/v3/openapi.json',
      })
    ).toEqual(
      "displayRequestDuration: true,url: 'https://petstore3.swagger.io/api/v3/openapi.json'"
    ))

  it('renders correctly with filter', () =>
    expect(
      renderSwaggerUIOptions({
        filter: true,
        url: 'https://petstore3.swagger.io/api/v3/openapi.json',
      })
    ).toEqual("filter: true,url: 'https://petstore3.swagger.io/api/v3/openapi.json'"))

  it('renders correctly with showExtensions', () =>
    expect(
      renderSwaggerUIOptions({
        showExtensions: true,
        url: 'https://petstore3.swagger.io/api/v3/openapi.json',
      })
    ).toEqual("showExtensions: true,url: 'https://petstore3.swagger.io/api/v3/openapi.json'"))

  it('renders correctly with showCommonExtensions', () =>
    expect(
      renderSwaggerUIOptions({
        showCommonExtensions: true,
        url: 'https://petstore3.swagger.io/api/v3/openapi.json',
      })
    ).toEqual("showCommonExtensions: true,url: 'https://petstore3.swagger.io/api/v3/openapi.json'"))

  it('renders correctly with queryConfigEnabled', () =>
    expect(
      renderSwaggerUIOptions({
        queryConfigEnabled: true,
        url: 'https://petstore3.swagger.io/api/v3/openapi.json',
      })
    ).toEqual("queryConfigEnabled: true,url: 'https://petstore3.swagger.io/api/v3/openapi.json'"))

  it('renders correctly with displayOperationId', () =>
    expect(
      renderSwaggerUIOptions({
        displayOperationId: true,
        url: 'https://petstore3.swagger.io/api/v3/openapi.json',
      })
    ).toEqual("displayOperationId: true,url: 'https://petstore3.swagger.io/api/v3/openapi.json'"))

  it('renders correctly with tagsSorter', () =>
    expect(
      renderSwaggerUIOptions({
        tagsSorter: '(a, b) => a.name.localeCompare(b.name)',
        url: 'https://petstore3.swagger.io/api/v3/openapi.json',
      })
    ).toEqual(
      "tagsSorter: (a, b) => a.name.localeCompare(b.name),url: 'https://petstore3.swagger.io/api/v3/openapi.json'"
    ))

  it('renders correctly with useUnsafeMarkdown', () =>
    expect(
      renderSwaggerUIOptions({
        useUnsafeMarkdown: true,
        url: 'https://petstore3.swagger.io/api/v3/openapi.json',
      })
    ).toEqual("useUnsafeMarkdown: true,url: 'https://petstore3.swagger.io/api/v3/openapi.json'"))

  it('renders correctly with onComplete', () =>
    expect(
      renderSwaggerUIOptions({
        onComplete: '() => console.log("Completed")',
        url: 'https://petstore3.swagger.io/api/v3/openapi.json',
      })
    ).toEqual(
      'onComplete: () => console.log("Completed"),url: \'https://petstore3.swagger.io/api/v3/openapi.json\''
    ))

  it('renders correctly with syntaxHighlight as false', () =>
    expect(
      renderSwaggerUIOptions({
        syntaxHighlight: false,
        url: 'https://petstore3.swagger.io/api/v3/openapi.json',
      })
    ).toEqual("syntaxHighlight: false,url: 'https://petstore3.swagger.io/api/v3/openapi.json'"))

  it('renders correctly with syntaxHighlight as object', () =>
    expect(
      renderSwaggerUIOptions({
        syntaxHighlight: { activated: true, theme: ['agate', 'arta'] },
        url: 'https://petstore3.swagger.io/api/v3/openapi.json',
      })
    ).toEqual(
      'syntaxHighlight: {"activated":true,"theme":["agate","arta"]},url: \'https://petstore3.swagger.io/api/v3/openapi.json\''
    ))

  it('renders correctly with tryItOutEnabled', () =>
    expect(
      renderSwaggerUIOptions({
        tryItOutEnabled: true,
        url: 'https://petstore3.swagger.io/api/v3/openapi.json',
      })
    ).toEqual("tryItOutEnabled: true,url: 'https://petstore3.swagger.io/api/v3/openapi.json'"))

  it('renders correctly with requestSnippets', () =>
    expect(
      renderSwaggerUIOptions({
        requestSnippets: { generators: { curl_bash: { title: 'cURL (bash)' } } },
        url: 'https://petstore3.swagger.io/api/v3/openapi.json',
      })
    ).toEqual(
      'requestSnippets: {"generators":{"curl_bash":{"title":"cURL (bash)"}}},url: \'https://petstore3.swagger.io/api/v3/openapi.json\''
    ))

  it('renders correctly with oauth2RedirectUrl', () =>
    expect(
      renderSwaggerUIOptions({
        oauth2RedirectUrl: 'https://example.com/oauth2-redirect.html',
        url: 'https://petstore3.swagger.io/api/v3/openapi.json',
      })
    ).toEqual(
      "oauth2RedirectUrl: 'https://example.com/oauth2-redirect.html',url: 'https://petstore3.swagger.io/api/v3/openapi.json'"
    ))

  it('renders correctly with showMutableRequest', () =>
    expect(
      renderSwaggerUIOptions({
        showMutableRequest: true,
        url: 'https://petstore3.swagger.io/api/v3/openapi.json',
      })
    ).toEqual("showMutableRequest: true,url: 'https://petstore3.swagger.io/api/v3/openapi.json'"))

  it('renders correctly with request', () =>
    expect(
      renderSwaggerUIOptions({
        request: { curlOptions: ['--insecure'] },
        url: 'https://petstore3.swagger.io/api/v3/openapi.json',
      })
    ).toEqual(
      'request: {"curlOptions":["--insecure"]},url: \'https://petstore3.swagger.io/api/v3/openapi.json\''
    ))

  it('renders correctly with supportedSubmitMethods', () =>
    expect(
      renderSwaggerUIOptions({
        supportedSubmitMethods: ['get', 'post', 'put'],
        url: 'https://petstore3.swagger.io/api/v3/openapi.json',
      })
    ).toEqual(
      "supportedSubmitMethods: [get,post,put],url: 'https://petstore3.swagger.io/api/v3/openapi.json'"
    ))

  it('renders correctly with validatorUrl', () =>
    expect(
      renderSwaggerUIOptions({
        validatorUrl: 'https://validator.swagger.io',
        url: 'https://petstore3.swagger.io/api/v3/openapi.json',
      })
    ).toEqual(
      "validatorUrl: 'https://validator.swagger.io',url: 'https://petstore3.swagger.io/api/v3/openapi.json'"
    ))

  it('renders correctly with withCredentials', () =>
    expect(
      renderSwaggerUIOptions({
        withCredentials: true,
        url: 'https://petstore3.swagger.io/api/v3/openapi.json',
      })
    ).toEqual("withCredentials: true,url: 'https://petstore3.swagger.io/api/v3/openapi.json'"))

  it('renders correctly with modelPropertyMacro', () =>
    expect(
      renderSwaggerUIOptions({
        modelPropertyMacro: '(property) => property',
        url: 'https://petstore3.swagger.io/api/v3/openapi.json',
      })
    ).toEqual(
      "modelPropertyMacro: (property) => property,url: 'https://petstore3.swagger.io/api/v3/openapi.json'"
    ))

  it('renders correctly with parameterMacro', () =>
    expect(
      renderSwaggerUIOptions({
        parameterMacro: '(parameter) => parameter',
        url: 'https://petstore3.swagger.io/api/v3/openapi.json',
      })
    ).toEqual(
      "parameterMacro: (parameter) => parameter,url: 'https://petstore3.swagger.io/api/v3/openapi.json'"
    ))
})
