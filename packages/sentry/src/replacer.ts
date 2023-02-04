// @denoify-ignore
import { makeThisModuleAnExecutableReplacer, ParsedImportExportStatement } from 'denoify'

makeThisModuleAnExecutableReplacer(async ({ parsedImportExportStatement, version }) => {
  if (parsedImportExportStatement.parsedArgument.nodeModuleName === 'toucan-js') {
    return ParsedImportExportStatement.stringify({
      ...parsedImportExportStatement,
      parsedArgument: {
        type: 'URL',
        url: `https://cdn.skypack.dev/toucan-js@${version}`,
      },
    })
  }

  if (parsedImportExportStatement.parsedArgument.nodeModuleName === 'hono') {
    return ParsedImportExportStatement.stringify({
      ...parsedImportExportStatement,
      parsedArgument: {
        type: 'URL',
        url: `https://deno.land/x/hono/mod.ts`,
      },
    })
  }

  return undefined
})
