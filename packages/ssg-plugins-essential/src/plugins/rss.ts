import type { AfterGenerateHook, AfterResponseHook, BeforeRequestHook, SSGPlugin } from 'hono/ssg'
import { DEFAULT_OUTPUT_DIR } from 'hono/ssg'
import path from 'node:path'

const extractTitleFromHtml = (html: string): string => {
  const match = html.match(/<title>(.*?)<\/title>/i)
  return match ? match[1] : ''
}

const extractDescriptionFromHtml = (html: string): string | undefined => {
  const match = html.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i)
  return match ? match[1] : undefined
}

type FeedType = 'rss2'

type FeedItem = {
  title: string
  link: string
  description?: string
}
/**
 * RSS plugin options.
 *
 * @property baseURL - The base URL of the site, used to generate full URLs in the RSS feed.
 * @property feedTitle - The title of the RSS feed.
 * @property feedDescription - The description of the RSS feed.
 * @property feedType - The type of RSS feed to generate. Default is RSS 2.0.
 */
export type RssPluginOptions = {
  baseURL: string
  feedTitle: string
  feedDescription: string
  feedType?: FeedType
}

/**
 * RSS plugin for Hono SSG.
 *
 * Generates an RSS feed file in the output directory.
 *
 * @param options - Options for the RSS plugin.
 * @returns A SSGPlugin to create the feed.
 */

export const rssPlugin = (options: RssPluginOptions): SSGPlugin => {
  const feedItems: FeedItem[] = []
  const pendingUrls: string[] = []

  const beforeRequestHook: BeforeRequestHook = async (request) => {
    const url = new URL(request.url)
    pendingUrls.push(url.pathname)
    return request
  }

  const afterResponseHook: AfterResponseHook = async (response) => {
    const contentType = response.headers.get('Content-Type') ?? ''
    if (contentType.includes('text/html')) {
      const html = await response.text()
      const title = extractTitleFromHtml(html)
      const description = extractDescriptionFromHtml(html)
      const path = pendingUrls.shift() ?? ''
      const normalizedBaseURL = options.baseURL.endsWith('/')
        ? options.baseURL
        : `${options.baseURL}/`
      const url = path ? `${normalizedBaseURL}${path.replace(/^\//, '')}` : normalizedBaseURL
      feedItems.push({ title, link: url, description })
      return new Response(html, response)
    }
    return response
  }

  const afterGenerateHook: AfterGenerateHook = async (_result, fsModule, ssgOptions) => {
    const outputDir = ssgOptions?.dir ?? DEFAULT_OUTPUT_DIR
    const fileName = 'rss.xml'
    const filePath = path.join(outputDir, fileName)
    const normalizedBaseURL = options.baseURL.endsWith('/')
      ? options.baseURL
      : `${options.baseURL}/`
    const feedLink = `${normalizedBaseURL}${fileName}`

    const rssFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title>${options.feedTitle}</title>
<link>${feedLink}</link>
<description>${options.feedDescription}</description>
${feedItems
  .map(
    (item) => `<item>
<title>${item.title}</title>
<link>${item.link}</link>
${item.description ? `<description>${item.description}</description>` : ''}
</item>`
  )
  .join('\n')}
</channel>
</rss>
`
    await fsModule.writeFile(filePath, rssFeed)
  }

  return {
    beforeRequestHook,
    afterResponseHook,
    afterGenerateHook,
  }
}
