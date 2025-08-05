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
  description?: string
}

/**
 * RSS plugin options.
 *
 * @property baseUrl - The base URL of the site, used to generate full URLs in the RSS feed.
 * @property feedTitle - The title of the RSS feed.
 * @property feedDescription - The description of the RSS feed.
 * @property feedType - The type of RSS feed to generate. Default is RSS 2.0.
 * @property canonicalize - Whether to canonicalize URLs in the RSS feed. If true, URLs ending with `.html` are canonicalized to remove the extension (e.g., `/foo.html` -> `/foo`). URLs ending with `index.html` are always canonicalized. Default is true.
 */
export type RssPluginOptions = {
  baseUrl: string
  feedTitle: string
  feedDescription: string
  feedType?: FeedType
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
    const normalizedOutputDir = outputDir.replace(/^\.\//, '').replace(/\/$/, '')

    const items = result.files
      .filter((file) => file.endsWith('.html'))
      .map((file) => {
        let cleanedFile = file.replace(/^\.\//, '')
        if (cleanedFile.startsWith(normalizedOutputDir + '/')) {
          cleanedFile = cleanedFile.slice(normalizedOutputDir.length + 1)
        }

        let path = '/' + cleanedFile
        if (path.endsWith('/index.html')) {
          path = path.slice(0, -'index.html'.length) || '/'
        } else if (path.endsWith('.html')) {
          path = path.slice(0, -'.html'.length)
        }

        const meta = feedItemMap[path]
        let url: string
        if (cleanedFile.endsWith('index.html')) {
          const dir = cleanedFile.slice(0, -'index.html'.length)
          url = `${normalizedBaseURL}${encodeURI(dir)}`
        } else if (canonicalize && cleanedFile.endsWith('.html')) {
          url = `${normalizedBaseURL}${encodeURI(cleanedFile.slice(0, -'.html'.length))}`
        } else {
          url = `${normalizedBaseURL}${encodeURI(cleanedFile)}`
        }
        return {
          title: meta?.title ?? '',
          description: meta?.description ?? '',
          link: url,
        }
      })

    const rssFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title>${options.feedTitle}</title>
<link>${feedLink}</link>
<description>${options.feedDescription}</description>
${items
  .map(
    (item) => `<item>
<title>${item.title}</title>
<link>${item.link}</link>
<description>${item.description ?? ''}</description>
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
