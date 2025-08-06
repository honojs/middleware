import type { SSGPlugin } from 'hono/ssg'
import { DEFAULT_OUTPUT_DIR } from 'hono/ssg'
import path from 'node:path'

/**
 * Robots.txt plugin options.
 */
export type RobotsTxtPluginOptions = {
  /** An array of rules for user agents. */
  rules?: {
    /** The user agent to apply the rules to. Use `*` for all user agents. */
    userAgent: string
    /** An array of paths to allow for the user agent. */
    allow?: string[]
    /** An array of paths to disallow for the user agent. */
    disallow?: string[]
    /** An array of extra lines to include for the user agent. */
    extraLines?: string[]
  }[]
  /** The URL of the sitemap to include in the `robots.txt` file. */
  sitemapUrl?: string
  /** An array of extra lines to include in the `robots.txt` file. */
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
export const robotsTxtPlugin = (options: RobotsTxtPluginOptions): SSGPlugin => {
  return {
    afterGenerateHook: async (_result, fsModule, ssgOptions) => {
      const outputDir = ssgOptions?.dir ?? DEFAULT_OUTPUT_DIR
      const filePath = path.join(outputDir, 'robots.txt')

      const lines: string[] = []

      if (options.rules && options.rules.length > 0) {
        for (const [i, rule] of options.rules.entries()) {
          lines.push(`User-agent: ${rule.userAgent}`)
          if (rule.allow) rule.allow.forEach((p) => lines.push(`Allow: ${p}`))
          if (rule.disallow) rule.disallow.forEach((p) => lines.push(`Disallow: ${p}`))
          if (rule.extraLines) lines.push(...rule.extraLines)
          if (i !== options.rules.length - 1) {
            lines.push('')
          }
        }
      } else {
        lines.push('User-agent: *')
      }

      if (options.sitemapUrl) {
        if (lines.length > 0 && lines[lines.length - 1] !== '') {
          lines.push('')
        }
        lines.push(`Sitemap: ${options.sitemapUrl}`)
      }

      if (options.extraLines) {
        if (lines.length > 0 && lines[lines.length - 1] !== '') {
          lines.push('')
        }
        lines.push(...options.extraLines)
      }

      const robotsTxtContent = lines.join('\n') + '\n'
      await fsModule.writeFile(filePath, robotsTxtContent)
    },
  }
}
