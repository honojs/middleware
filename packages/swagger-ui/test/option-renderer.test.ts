/*eslint quotes: ["off", "single"]*/

import type { DistSwaggerUIOptions } from '../src/swagger/renderer'
import { renderSwaggerUIOptions } from '../src/swagger/renderer'

type TestCase = [description: string, config: DistSwaggerUIOptions, expected: string]

describe('SwaggerUIOption Rendering', () => {
  const baseUrl = 'https://petstore3.swagger.io/api/v3/openapi.json'
  const commonTests: TestCase[] = [
    [
      'configUrl',
      { configUrl: baseUrl, url: baseUrl },
      `configUrl: '${baseUrl}',url: '${baseUrl}'`,
    ],
    [
      'presets',
      { presets: ['SwaggerUIBundle.presets.apis', 'SwaggerUIStandalonePreset'], url: baseUrl },
      `presets: [SwaggerUIBundle.presets.apis,SwaggerUIStandalonePreset],url: '${baseUrl}'`,
    ],
    [
      'plugins',
      { plugins: ['SwaggerUIBundle.plugins.DownloadUrl'], url: baseUrl },
      `plugins: [SwaggerUIBundle.plugins.DownloadUrl],url: '${baseUrl}'`,
    ],
    ['deepLinking', { deepLinking: true, url: baseUrl }, `deepLinking: true,url: '${baseUrl}'`],
    [
      'spec',
      {
        spec: {
          openapi: '3.0.0',
          info: { title: 'Swagger Petstore', version: '1.0.0' },
          servers: [{ url: 'https://petstore3.swagger.io/api/v3' }],
        },
        url: baseUrl,
      },
      `spec: {"openapi":"3.0.0","info":{"title":"Swagger Petstore","version":"1.0.0"},"servers":[{"url":"https://petstore3.swagger.io/api/v3"}]},url: '${baseUrl}'`,
    ],
    [
      'layout',
      { layout: 'StandaloneLayout', url: baseUrl },
      `layout: 'StandaloneLayout',url: '${baseUrl}'`,
    ],
    [
      'docExpansion',
      { docExpansion: 'list', url: baseUrl },
      `docExpansion: 'list',url: '${baseUrl}'`,
    ],
    [
      'maxDisplayedTags',
      { maxDisplayedTags: 5, url: baseUrl },
      `maxDisplayedTags: 5,url: '${baseUrl}'`,
    ],
    [
      'operationsSorter',
      { operationsSorter: '(a, b) => a.path.localeCompare(b.path)', url: baseUrl },
      `operationsSorter: (a, b) => a.path.localeCompare(b.path),url: '${baseUrl}'`,
    ],
    [
      'requestInterceptor',
      { requestInterceptor: '(req) => req', url: baseUrl },
      `requestInterceptor: (req) => req,url: '${baseUrl}'`,
    ],
    [
      'responseInterceptor',
      { responseInterceptor: '(res) => res', url: baseUrl },
      `responseInterceptor: (res) => res,url: '${baseUrl}'`,
    ],
    [
      'persistAuthorization',
      { persistAuthorization: true, url: baseUrl },
      `persistAuthorization: true,url: '${baseUrl}'`,
    ],
    [
      'defaultModelsExpandDepth',
      { defaultModelsExpandDepth: 1, url: baseUrl },
      `defaultModelsExpandDepth: 1,url: '${baseUrl}'`,
    ],
    [
      'defaultModelExpandDepth',
      { defaultModelExpandDepth: 2, url: baseUrl },
      `defaultModelExpandDepth: 2,url: '${baseUrl}'`,
    ],
    [
      'defaultModelRendering',
      { defaultModelRendering: 'model', url: baseUrl },
      `defaultModelRendering: 'model',url: '${baseUrl}'`,
    ],
    [
      'displayRequestDuration',
      { displayRequestDuration: true, url: baseUrl },
      `displayRequestDuration: true,url: '${baseUrl}'`,
    ],
    ['filter', { filter: true, url: baseUrl }, `filter: true,url: '${baseUrl}'`],
    [
      'showExtensions',
      { showExtensions: true, url: baseUrl },
      `showExtensions: true,url: '${baseUrl}'`,
    ],
    [
      'showCommonExtensions',
      { showCommonExtensions: true, url: baseUrl },
      `showCommonExtensions: true,url: '${baseUrl}'`,
    ],
    [
      'queryConfigEnabled',
      { queryConfigEnabled: true, url: baseUrl },
      `queryConfigEnabled: true,url: '${baseUrl}'`,
    ],
    [
      'displayOperationId',
      { displayOperationId: true, url: baseUrl },
      `displayOperationId: true,url: '${baseUrl}'`,
    ],
    [
      'tagsSorter',
      { tagsSorter: '(a, b) => a.name.localeCompare(b.name)', url: baseUrl },
      `tagsSorter: (a, b) => a.name.localeCompare(b.name),url: '${baseUrl}'`,
    ],
    [
      'onComplete',
      { onComplete: '() => console.log("Completed")', url: baseUrl },
      `onComplete: () => console.log("Completed"),url: '${baseUrl}'`,
    ],
    [
      'syntaxHighlight as false',
      { syntaxHighlight: false, url: baseUrl },
      `syntaxHighlight: false,url: '${baseUrl}'`,
    ],
    [
      'syntaxHighlight as object',
      { syntaxHighlight: { activated: true, theme: ['agate', 'arta'] }, url: baseUrl },
      `syntaxHighlight: {"activated":true,"theme":["agate","arta"]},url: '${baseUrl}'`,
    ],
    [
      'tryItOutEnabled',
      { tryItOutEnabled: true, url: baseUrl },
      `tryItOutEnabled: true,url: '${baseUrl}'`,
    ],
    [
      'requestSnippets',
      { requestSnippets: { generators: { curl_bash: { title: 'cURL (bash)' } } }, url: baseUrl },
      `requestSnippets: {"generators":{"curl_bash":{"title":"cURL (bash)"}}},url: '${baseUrl}'`,
    ],
    [
      'oauth2RedirectUrl',
      { oauth2RedirectUrl: 'https://example.com/oauth2-redirect.html', url: baseUrl },
      `oauth2RedirectUrl: 'https://example.com/oauth2-redirect.html',url: '${baseUrl}'`,
    ],
    [
      'showMutableRequest',
      { showMutableRequest: true, url: baseUrl },
      `showMutableRequest: true,url: '${baseUrl}'`,
    ],
    [
      'request',
      { request: { curlOptions: ['--insecure'] }, url: baseUrl },
      `request: {"curlOptions":["--insecure"]},url: '${baseUrl}'`,
    ],
    [
      'supportedSubmitMethods',
      { supportedSubmitMethods: ['get', 'post', 'put'], url: baseUrl },
      `supportedSubmitMethods: ["get","post","put"],url: '${baseUrl}'`,
    ],
    [
      'validatorUrl',
      { validatorUrl: 'https://validator.swagger.io', url: baseUrl },
      `validatorUrl: 'https://validator.swagger.io',url: '${baseUrl}'`,
    ],
    [
      'withCredentials',
      { withCredentials: true, url: baseUrl },
      `withCredentials: true,url: '${baseUrl}'`,
    ],
    [
      'modelPropertyMacro',
      { modelPropertyMacro: '(property) => property', url: baseUrl },
      `modelPropertyMacro: (property) => property,url: '${baseUrl}'`,
    ],
    [
      'parameterMacro',
      { parameterMacro: '(parameter) => parameter', url: baseUrl },
      `parameterMacro: (parameter) => parameter,url: '${baseUrl}'`,
    ],
  ]

  it.each(commonTests)('renders correctly with %s', (_, input, expected) => {
    expect(renderSwaggerUIOptions(input)).toEqual(expected)
  })
})
