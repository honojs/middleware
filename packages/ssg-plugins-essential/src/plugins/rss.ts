import { html } from 'hono/html'
import type { AfterGenerateHook, AfterResponseHook, BeforeRequestHook, SSGPlugin } from 'hono/ssg'
import { DEFAULT_OUTPUT_DIR } from 'hono/ssg'
import path from 'node:path'
import { canonicalizeFilePath } from '../utils/canonicalizeFilePath'

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
  description?: string
}

/**
 * RSS plugin options.
 */
export type RssPluginOptions = {
  /** The base URL of the site, used to generate full URLs in the RSS feed. */
  baseUrl: string
  /** The title of the RSS feed. */
  feedTitle: string
  /** The description of the RSS feed. */
  feedDescription: string
  /** The type of RSS feed to generate. Default is RSS 2.0. */
  feedType?: FeedType
  /** Whether to canonicalize URLs in the RSS feed. If true, URLs ending with `.html` are canonicalized to remove the extension (e.g., `/foo.html` -> `/foo`). URLs ending with `index.html` are always canonicalized. Default is true. */
  canonicalize?: boolean
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
  const feedItemMap: Record<string, FeedItem> = {}
  const pendingPaths: string[] = []
  const canonicalize = options.canonicalize ?? true

  const beforeRequestHook: BeforeRequestHook = async (request) => {
    const url = new URL(request.url)
    pendingPaths.push(url.pathname)
    return request
  }

  const afterResponseHook: AfterResponseHook = async (response) => {
    const contentType = response.headers.get('Content-Type') ?? ''
    if (contentType.includes('text/html')) {
      const html = await response.text()
      const title = extractTitleFromHtml(html)
      const description = extractDescriptionFromHtml(html)
      const path = pendingPaths.shift() ?? ''
      feedItemMap[path] = { title, description }
      return new Response(html, response)
    }
    return response
  }

  const afterGenerateHook: AfterGenerateHook = async (result, fsModule, ssgOptions) => {
    const outputDir = ssgOptions?.dir ?? DEFAULT_OUTPUT_DIR
    const fileName = 'rss.xml'
    const filePath = path.join(outputDir, fileName)
    const normalizedBaseURL = options.baseUrl.endsWith('/')
      ? options.baseUrl
      : `${options.baseUrl}/`
    const feedLink = `${normalizedBaseURL}${fileName}`

    const items = result.files
      .filter((file) => file.endsWith('.html'))
      .map((file) => {
        const { routePath, url } = canonicalizeFilePath(
          file,
          outputDir,
          options.baseUrl,
          canonicalize
        )
        const meta = feedItemMap[routePath]
        return {
          title: meta?.title ?? '',
          description: meta?.description ?? '',
          link: url,
        }
      })

    const rssFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title>${html`${options.feedTitle}`}</title>
<link>${feedLink}</link>
<description>${html`${options.feedDescription}`}</description>
${items
  .map(
    (item) => `<item>
<title>${html`${item.title}`}</title>
<link>${item.link}</link>
<description>${html`${item.description ?? ''}`}</description>
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
