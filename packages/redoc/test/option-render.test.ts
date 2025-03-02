import type { RedocRawOptions } from 'redoc'
import { renderRedocOptions } from '../src/redoc/renderer'

describe('RedocOption Rendering', () => {
  const baseUrl = 'https://example.com/openapi.json'

  test.each`
    description                   | config                                           | expected
    ${'scrollYOffset'}            | ${{ scrollYOffset: 100 }}                        | ${'"scrollYOffset": "100"'}
    ${'expandResponses'}          | ${{ expandResponses: 'all' }}                    | ${'"expandResponses": "all"'}
    ${'downloadFileName'}         | ${{ downloadFileName: 'swagger-definition' }}    | ${'"downloadFileName": "swagger-definition"'}
    ${'disableSearch'}            | ${{ disableSearch: true }}                       | ${'"disableSearch": "true"'}
    ${'showExtensions'}           | ${{ showExtensions: { 'x-custom': 'example' } }} | ${'"showExtensions": {"x-custom":"example"}'}
    ${'allowedMdComponents'}      | ${{ allowedMdComponents: ['CustomComponent'] }}  | ${'"allowedMdComponents": ["CustomComponent"]'}
    ${'labels'}                   | ${{ labels: { label1: 'value1' } }}              | ${'"labels": {"label1":"value1"}'}
    ${'hideRequestPayloadSample'} | ${{ hideRequestPayloadSample: true }}            | ${'"hideRequestPayloadSample": "true"'}
    ${'hideSchemaTitles'}         | ${{ hideSchemaTitles: true }}                    | ${'"hideSchemaTitles": "true"'}
    ${'downloadDefinitionUrl'}    | ${{ downloadDefinitionUrl: baseUrl }}            | ${`"downloadDefinitionUrl": "${baseUrl}"`}
  `('should correctly render the option for $description', (testCase) => {
    const { description, config, expected } = testCase
    const result = renderRedocOptions(config)
    expect(result).toContain(expected)
  })
})
