import type { SSGPlugin } from 'hono/ssg'
import { DEFAULT_OUTPUT_DIR } from 'hono/ssg'
import path from 'node:path'

/**
 * Robots.txt plugin options.
 *
 * @property rules - An array of rules for user agents.
 * @property sitemapUrl - The URL of the sitemap to include in the `robots.txt` file.
 * @property extraLines - An array of extra lines to include in the robots.txt file.
 */
export type RobotsTxtPluginOptions = {
  rules?: {
    userAgent: string
    allow?: string[]
    disallow?: string[]
  }[]
  sitemapUrl?: string
  extraLines?: string[]
}

/**
 * robots.txt plugin for Hono SSG.
 *
 * Generates a `robots.txt` file in the output directory.
 *
 * @param options - Options for the robots.txt plugin.
 * @returns A SSGPlugin to create the `robots.txt`.
 */
export const robotsTxtPlugin = (options: RobotsTxtPluginOptions = {}): SSGPlugin => {
  return {
    afterGenerateHook: async (_result, fsModule, ssgOptions) => {
      const outputDir = ssgOptions?.dir ?? DEFAULT_OUTPUT_DIR
      const filePath = path.join(outputDir, 'robots.txt')

      const lines: string[] = []

      if (options.rules && options.rules.length > 0) {
        for (const rule of options.rules) {
          lines.push(`User-agent: ${rule.userAgent}`)
          if (rule.allow) rule.allow.forEach((p) => lines.push(`Allow: ${p}`))
          if (rule.disallow) rule.disallow.forEach((p) => lines.push(`Disallow: ${p}`))
        }
      } else {
        lines.push('User-agent: *')
      }

      if (options.sitemapUrl) {
        lines.push(`Sitemap: ${options.sitemapUrl}`)
      }

      if (options.extraLines) {
        lines.push(...options.extraLines)
      }

      const robotsTxtContent = lines.join('\n') + '\n'
      await fsModule.writeFile(filePath, robotsTxtContent)
    },
  }
}
