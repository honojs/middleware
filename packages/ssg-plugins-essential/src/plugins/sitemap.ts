import type { SSGPlugin } from 'hono/ssg'
import { DEFAULT_OUTPUT_DIR } from 'hono/ssg'
import path from 'node:path'

/**
 * Sitemap plugin options.
 *
 * @property baseUrl - The base URL of the site, used to generate full URLs in the sitemap.
 * @property canonicalize - Whether to canonicalize URLs in the sitemap. If true, URLs ending with `.html` are canonicalized to remove the extension (e.g., `/foo.html` -> `/foo`). URLs ending with `index.html` are always canonicalized. Default is true.
 */
export type SitemapPluginOptions = {
  baseUrl: string
  canonicalize?: boolean
}

/**
 * Sitemap plugin for Hono SSG.
 *
 * Generates a `sitemap.xml` file based on the files generated during the SSG process.
 *
 * @param options - Options for the sitemap plugin.
 * @returns A SSGPlugin to create the sitemap.
 */
export const sitemapPlugin = ({
  baseUrl,
  canonicalize = true,
}: SitemapPluginOptions): SSGPlugin => {
  return {
    afterGenerateHook: async (result, fsModule, options) => {
      const outputDir = options?.dir ?? DEFAULT_OUTPUT_DIR
      const filePath = path.join(outputDir, 'sitemap.xml')
      const normalizedBaseURL = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
      const outputDirNormalized = outputDir.replace(/^\.\//, '').replace(/\/$/, '')

      const urls = result.files
        .filter((file) => file.endsWith('.html'))
        .map((file) => {
          let cleanedFile = file.replace(/^\.\//, '')
          if (cleanedFile.startsWith(outputDirNormalized + '/')) {
            cleanedFile = cleanedFile.slice(outputDirNormalized.length + 1)
          }
          if (cleanedFile.endsWith('index.html')) {
            const dir = cleanedFile.slice(0, -'index.html'.length)
            return `${normalizedBaseURL}${encodeURI(dir)}`
          }
          if (canonicalize && cleanedFile.endsWith('.html')) {
            return `${normalizedBaseURL}${encodeURI(cleanedFile.slice(0, -'.html'.length))}`
          }
          return `${normalizedBaseURL}${encodeURI(cleanedFile)}`
        })

      const siteMapText = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `<url><loc>${url}</loc></url>`).join('\n')}
</urlset>
`
      await fsModule.writeFile(filePath, siteMapText)
    },
  }
}
