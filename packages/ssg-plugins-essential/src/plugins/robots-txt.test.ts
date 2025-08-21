import { Hono } from 'hono'
import { DEFAULT_OUTPUT_DIR, toSSG } from 'hono/ssg'
import type { FileSystemModule } from 'hono/ssg'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import path from 'node:path'
import { robotsTxtPlugin } from './robots-txt'

describe('robots.txt Plugin', () => {
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

  it('should generate robots.txt with default rule', async () => {
    const app = new Hono()
    app.get('/', (c) => c.text('Hello'))
    const plugin = robotsTxtPlugin({})
    await toSSG(app, mockFsModule, {
      plugins: [plugin],
      dir: DEFAULT_OUTPUT_DIR,
    })
    const expectedPath = path.join(DEFAULT_OUTPUT_DIR, 'robots.txt')
    expect(mockFsModule.writeFile).toHaveBeenCalledWith(expectedPath, expect.any(String))
    const content = writtenFiles[expectedPath]
    expect(content).toContain('User-agent: *')
  })

  it('should generate robots.txt with custom rules', async () => {
    const app = new Hono()
    app.get('/', (c) => c.text('Hello'))
    const plugin = robotsTxtPlugin({
      rules: [
        { userAgent: 'Googlebot', allow: ['/'], disallow: ['/private/'] },
        { userAgent: 'Bingbot', disallow: ['/'] },
      ],
    })
    await toSSG(app, mockFsModule, {
      plugins: [plugin],
      dir: DEFAULT_OUTPUT_DIR,
    })
    const expectedPath = path.join(DEFAULT_OUTPUT_DIR, 'robots.txt')
    const content = writtenFiles[expectedPath]
    expect(content).toContain('User-agent: Googlebot')
    expect(content).toContain('Allow: /')
    expect(content).toContain('Disallow: /private/')
    expect(content).toContain('User-agent: Bingbot')
    expect(content).toContain('Disallow: /')
  })

  it('should include sitemap line', async () => {
    const app = new Hono()
    app.get('/', (c) => c.text('Hello'))
    const plugin = robotsTxtPlugin({
      sitemapUrl: 'https://example.com/sitemap.xml',
    })
    await toSSG(app, mockFsModule, {
      plugins: [plugin],
      dir: DEFAULT_OUTPUT_DIR,
    })
    const expectedPath = path.join(DEFAULT_OUTPUT_DIR, 'robots.txt')
    const content = writtenFiles[expectedPath]
    expect(content).toContain('Sitemap: https://example.com/sitemap.xml')
  })

  it('should include extra lines', async () => {
    const app = new Hono()
    app.get('/', (c) => c.text('Hello'))
    const plugin = robotsTxtPlugin({
      extraLines: ['# Extra comment', 'Crawl-delay: 10'],
    })
    await toSSG(app, mockFsModule, {
      plugins: [plugin],
      dir: DEFAULT_OUTPUT_DIR,
    })
    const expectedPath = path.join(DEFAULT_OUTPUT_DIR, 'robots.txt')
    const content = writtenFiles[expectedPath]
    expect(content).toContain('# Extra comment')
    expect(content).toContain('Crawl-delay: 10')
  })

  it('should use custom output directory', async () => {
    const app = new Hono()
    app.get('/', (c) => c.text('Hello'))
    const plugin = robotsTxtPlugin({})
    await toSSG(app, mockFsModule, {
      plugins: [plugin],
      dir: 'dist',
    })
    expect(mockFsModule.writeFile).toHaveBeenCalledWith('dist/robots.txt', expect.any(String))
  })

  it('should include extraLines for each user-agent rule', async () => {
    const app = new Hono()
    app.get('/', (c) => c.text('Hello'))
    const plugin = robotsTxtPlugin({
      rules: [
        {
          userAgent: 'Googlebot',
          allow: ['/'],
          extraLines: ['# Googlebot specific note'],
        },
        {
          userAgent: 'Bingbot',
          disallow: ['/'],
          extraLines: ['Crawl-delay: 5', '# Bingbot only'],
        },
      ],
    })
    await toSSG(app, mockFsModule, {
      plugins: [plugin],
      dir: DEFAULT_OUTPUT_DIR,
    })
    const expectedPath = path.join(DEFAULT_OUTPUT_DIR, 'robots.txt')
    const content = writtenFiles[expectedPath]
    const blocks = content.split(/\n{2,}/)
    const googleBlock = blocks.find((b) => b.includes('User-agent: Googlebot')) || ''
    const bingBlock = blocks.find((b) => b.includes('User-agent: Bingbot')) || ''
    expect(googleBlock).toContain('User-agent: Googlebot')
    expect(googleBlock).toContain('# Googlebot specific note')
    expect(googleBlock).not.toContain('Crawl-delay: 5')
    expect(bingBlock).toContain('User-agent: Bingbot')
    expect(bingBlock).toContain('Crawl-delay: 5')
    expect(bingBlock).toContain('# Bingbot only')
  })
})
