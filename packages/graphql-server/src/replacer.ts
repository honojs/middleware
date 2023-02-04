// @denoify-ignore
import { makeThisModuleAnExecutableReplacer, ParsedImportExportStatement } from 'denoify'

makeThisModuleAnExecutableReplacer(async ({ parsedImportExportStatement }) => {
  if (parsedImportExportStatement.parsedArgument.nodeModuleName === 'hono') {
    return ParsedImportExportStatement.stringify({
      ...parsedImportExportStatement,
      parsedArgument: {
        type: 'URL',
        url: 'https://deno.land/x/hono/mod.ts',
      },
    })
  }

  return undefined
})
