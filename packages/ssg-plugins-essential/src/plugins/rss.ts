import { html } from 'hono/html'
import type { AfterGenerateHook, AfterResponseHook, BeforeRequestHook, SSGPlugin } from 'hono/ssg'
import { DEFAULT_OUTPUT_DIR } from 'hono/ssg'
import { AsyncLocalStorage } from 'node:async_hooks'
import path from 'node:path'
import { canonicalizeFilePath } from '../utils/canonicalizeFilePath'

const ROUTE_PATH_SYMBOL = Symbol('hono_ssg_route_path')
const asyncLocalStorage = new AsyncLocalStorage<{ routePath: string }>()

interface SsgResponseWithRoute extends Response {
  [ROUTE_PATH_SYMBOL]?: string
}

let patchCount = 0
let origRequest: typeof globalThis.Request
let origResponse: typeof globalThis.Response

const installInterceptors = () => {
  if (patchCount === 0) {
    origRequest = globalThis.Request
    origResponse = globalThis.Response

    class SsgRequest extends origRequest {
      constructor(input: RequestInfo | URL, init?: RequestInit) {
        super(input, init)
        try {
          const rawUrl =
            typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
          const parsed = new URL(rawUrl)
          asyncLocalStorage.enterWith({ routePath: parsed.pathname })
        } catch {
          // Ignore invalid URL formatting
        }
      }
    }

    class SsgResponse extends origResponse implements SsgResponseWithRoute {
      [ROUTE_PATH_SYMBOL]?: string
      constructor(body?: BodyInit | null, init?: ResponseInit) {
        super(body, init)
        const store = asyncLocalStorage.getStore()
        if (store?.routePath) {
          this[ROUTE_PATH_SYMBOL] = store.routePath
        }
      }
    }

    globalThis.Request = SsgRequest as unknown as typeof globalThis.Request
    globalThis.Response = SsgResponse as unknown as typeof globalThis.Response
  }
  patchCount++
}

const restoreInterceptors = () => {
  if (patchCount > 0) {
    patchCount--
    if (patchCount === 0) {
      globalThis.Request = origRequest
      globalThis.Response = origResponse
    }
  }
}

const replaceUrlParam = (urlString: string, params: Record<string, string>): string => {
  let result = urlString
  for (const [k, v] of Object.entries(params)) {
    const reg = new RegExp(`/:${k}(?:{[^/]+})?\\??`)
    result = result.replace(reg, v ? `/${v}` : '')
  }
  return result
}

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
  let installed = false

  const beforeRequestHook: BeforeRequestHook = async (request) => {
    if (!installed) {
      installInterceptors()
      installed = true
    }

    let ssgParamsValue: Record<string, string>[] | undefined
    Object.defineProperty(request, 'ssgParams', {
      get(): Record<string, string>[] | undefined {
        return ssgParamsValue
      },
      set(val: unknown) {
        if (Array.isArray(val)) {
          ssgParamsValue = val as Record<string, string>[]
          const url = new URL(request.url)
          for (const param of ssgParamsValue) {
            const replaced = replaceUrlParam(url.pathname, param)
            pendingPaths.push(replaced)
          }
        }
      },
      configurable: true,
      enumerable: true,
    })

    return request
  }

  const afterResponseHook: AfterResponseHook = async (response) => {
    const resWithRoute = response as SsgResponseWithRoute
    const routePath = resWithRoute[ROUTE_PATH_SYMBOL] ?? pendingPaths.shift() ?? ''
    const contentType = response.headers.get('Content-Type') ?? ''
    if (contentType.includes('text/html')) {
      const html = await response.text()
      const title = extractTitleFromHtml(html)
      const description = extractDescriptionFromHtml(html)
      if (routePath) {
        feedItemMap[routePath] = { title, description }
      }
      const newResponse = new Response(html, response) as SsgResponseWithRoute
      if (routePath) {
        newResponse[ROUTE_PATH_SYMBOL] = routePath
      }
      return newResponse
    }
    return response
  }

  const afterGenerateHook: AfterGenerateHook = async (result, fsModule, ssgOptions) => {
    try {
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
    } finally {
      if (installed) {
        restoreInterceptors()
        installed = false
      }
    }
  }

  return {
    beforeRequestHook,
    afterResponseHook,
    afterGenerateHook,
  }
}
