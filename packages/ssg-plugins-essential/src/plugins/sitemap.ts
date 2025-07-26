import type { SSGPlugin } from 'hono/ssg'
import { DEFAULT_OUTPUT_DIR } from 'hono/ssg'
import path from 'node:path'

/**
 * Sitemap plugin options.
 *
 * @property baseURL - The base URL of the site, used to generate full URLs in the sitemap.
 */
export type SitemapPluginOptions = {
  baseURL: string
}

/**
 * Sitemap plugin for Hono SSG.
 *
 * Generates a `sitemap.xml` file based on the files generated during the SSG process.
 *
 * @param options - Options for the sitemap plugin.
 * @returns A SSGPlugin to create the sitemap.
 */
export const sitemapPlugin = ({ baseURL }: SitemapPluginOptions): SSGPlugin => {
  return {
    afterGenerateHook: async (result, fsModule, options) => {
      const outputDir = options?.dir ?? DEFAULT_OUTPUT_DIR
      const filePath = path.join(outputDir, 'sitemap.xml')
      const normalizedBaseURL = baseURL.endsWith('/') ? baseURL : `${baseURL}/`
      const urls = result.files.map((file) => {
        const cleanedFile = file.startsWith('./') ? file.slice(2) : file
        const encodedFile = encodeURI(cleanedFile)
        return `${normalizedBaseURL}${encodedFile}`
      })
      const siteMapText = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `<url><loc>${url}</loc></url>`).join('\n')}
</urlset>`
      await fsModule.writeFile(filePath, siteMapText)
    },
  }
}
