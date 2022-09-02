// @denoify-ignore
import { makeThisModuleAnExecutableReplacer } from 'denoify'

makeThisModuleAnExecutableReplacer(async ({ parsedImportExportStatement, version }) => {
  if (parsedImportExportStatement.parsedArgument.nodeModuleName === 'toucan-js') {
    return `import Toucan from 'https://cdn.skypack.dev/toucan-js@${version}'`
  }
  return undefined
})
