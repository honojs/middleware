import type { RedocRawOptions } from 'redoc'

const RENDER_TYPE_MAP: Record<keyof RedocRawOptions, 'STRING' | 'JSON_STRING' | 'RAW'> = {
  theme: 'JSON_STRING',
  scrollYOffset: 'RAW',
  hideHostname: 'RAW',
  expandResponses: 'RAW',
  requiredPropsFirst: 'RAW',
  sortPropsAlphabetically: 'RAW',
  sortEnumValuesAlphabetically: 'RAW',
  sortOperationsAlphabetically: 'RAW',
  sortTagsAlphabetically: 'RAW',
  nativeScrollbars: 'RAW',
  pathInMiddlePanel: 'RAW',
  untrustedSpec: 'RAW',
  hideLoading: 'RAW',
  hideDownloadButton: 'RAW',
  downloadFileName: 'STRING',
  downloadDefinitionUrl: 'STRING',
  disableSearch: 'RAW',
  onlyRequiredInSamples: 'RAW',
  showExtensions: 'JSON_STRING',
  sideNavStyle: 'STRING',
  hideSingleRequestSampleTab: 'RAW',
  hideRequestPayloadSample: 'RAW',
  menuToggle: 'RAW',
  jsonSampleExpandLevel: 'RAW',
  hideSchemaTitles: 'RAW',
  simpleOneOfTypeLabel: 'RAW',
  payloadSampleIdx: 'RAW',
  expandSingleSchemaField: 'RAW',
  schemaExpansionLevel: 'RAW',
  showObjectSchemaExamples: 'RAW',
  showSecuritySchemeType: 'RAW',
  hideSecuritySection: 'RAW',
  unstable_ignoreMimeParameters: 'RAW',
  allowedMdComponents: 'JSON_STRING',
  labels: 'JSON_STRING',
  enumSkipQuotes: 'RAW',
  expandDefaultServerVariables: 'RAW',
  maxDisplayedEnumValues: 'RAW',
  ignoreNamedSchemas: 'JSON_STRING',
  hideSchemaPattern: 'RAW',
  generatedPayloadSamplesMaxDepth: 'RAW',
  nonce: 'STRING',
  hideFab: 'RAW',
  minCharacterLengthToInitSearch: 'RAW',
  showWebhookVerb: 'RAW',
}

export const renderRedocOptions = (options: RedocRawOptions) => {
  console.log(JSON.stringify(options))
  const optionsStrings = Object.entries(options)
    .map(([key, value]) => {
      const typedKey = key as keyof RedocRawOptions

      if (RENDER_TYPE_MAP[typedKey] === 'STRING') {
        return `"${key}": "${value}"`
      }
      if (RENDER_TYPE_MAP[typedKey] === 'JSON_STRING') {
        return `"${key}": ${JSON.stringify(value)}`
      }
      if (RENDER_TYPE_MAP[typedKey] === 'RAW') {
        return `"${key}": "${value}"`
      }
      return ''
    })
    .filter(Boolean) // 空文字列を除去
    .join(',')

  return optionsStrings
}
