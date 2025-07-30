import { Hono } from 'hono'
import { DEFAULT_OUTPUT_DIR, toSSG } from 'hono/ssg'
import type { FileSystemModule, ToSSGResult } from 'hono/ssg'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import path from 'node:path'
import { rssPlugin } from './rss'

describe('RSS Plugin', () => {
  let writtenFiles: Record<string, string>
  let mockFsModule: FileSystemModule

  beforeEach(() => {
    writtenFiles = {}
    mockFsModule = {
      writeFile: vi.fn((filePath: string, data: string | Uint8Array) => {
        writtenFiles[filePath] = typeof data === 'string' ? data : data.toString()
        return Promise.resolve()
      }),
      mkdir: vi.fn(() => Promise.resolve()),
    }
  })

  it('should generate rss.xml from HTML routes', async () => {
    const app = new Hono()

    app.get('/', (c) =>
      c.html(
        `<html>
          <head>
            <title>Home Page</title>
            <meta name="description" content="Welcome to the homepage." />
          </head>
          <body>
            <h1>Hello RSS!</h1>
          </body>
        </html>`
      )
    )

    app.get('/about', (c) =>
      c.html(
        `<html>
          <head>
            <title>About Page</title>
            <meta name="description" content="About us page." />
          </head>
          <body>
            <h1>About</h1>
          </body>
        </html>`
      )
    )

    const plugin = rssPlugin({
      baseURL: 'https://example.com',
      feedTitle: 'Test Feed',
      feedDescription: 'This is a test RSS feed.',
      feedType: 'rss2',
    })

    const result: ToSSGResult = await toSSG(app, mockFsModule, {
      plugins: [plugin],
      dir: DEFAULT_OUTPUT_DIR,
    })

    const rssPath = path.join(DEFAULT_OUTPUT_DIR, 'rss.xml')
    expect(mockFsModule.writeFile).toHaveBeenCalledWith(rssPath, expect.any(String))
    const rssContent = writtenFiles[rssPath]
    expect(rssContent).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(rssContent).toContain('<rss version="2.0">')
    expect(rssContent).toContain('<channel>')
    expect(rssContent).toContain('</channel>')
    expect(rssContent).toContain('</rss>')
    expect(rssContent).toContain('<title>Test Feed</title>')
    expect(rssContent).toContain('<link>https://example.com/rss.xml</link>')
    expect(rssContent).toContain('<description>This is a test RSS feed.</description>')
    expect(rssContent).toMatch(
      /<item>\s*<title>Home Page<\/title>\s*<link>https:\/\/example\.com\/<\/link>\s*<description>Welcome to the homepage\.<\/description>\s*<\/item>/
    )
    expect(rssContent).toMatch(
      /<item>\s*<title>About Page<\/title>\s*<link>https:\/\/example\.com\/about<\/link>\s*<description>About us page\.<\/description>\s*<\/item>/
    )
    const itemMatches = rssContent.match(/<item>[\s\S]*?<\/item>/g)
    expect(itemMatches).not.toBeNull()
    expect(itemMatches?.length).toBe(2)
    expect(rssContent).not.toContain('<link></link>')
    expect(result.success).toBe(true)
    expect(mockFsModule.writeFile).toHaveBeenCalledWith(rssPath, expect.any(String))
  })
})
