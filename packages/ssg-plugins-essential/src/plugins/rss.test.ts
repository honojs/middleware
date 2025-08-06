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

  it('should generate RSS 2.0 feed with canonicalize=true (default)', async () => {
    const app = new Hono()
    app.get('/', (c) =>
      c.html(
        `<html><head><title>Home Page</title><meta name="description" content="Welcome to the homepage." /></head><body><h1>Hello RSS!</h1></body></html>`
      )
    )
    app.get('/about', (c) =>
      c.html(
        `<html><head><title>About Page</title><meta name="description" content="About us page." /></head><body><h1>About</h1></body></html>`
      )
    )
    app.get('/blog/post-1/', (c) =>
      c.html(
        `<html><head><title>Blog Post 1</title><meta name="description" content="Description for blog post 1." /></head><body><h1>Blog Post 1</h1></body></html>`
      )
    )

    const plugin = rssPlugin({
      baseUrl: 'https://example.com',
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
    expect(rssContent).toMatch(
      /<item>\s*<title>Blog Post 1<\/title>\s*<link>https:\/\/example\.com\/blog\/post-1\/<\/link>\s*<description>Description for blog post 1\.<\/description>\s*<\/item>/
    )
    const itemMatches = rssContent.match(/<item>[\s\S]*?<\/item>/g)
    expect(itemMatches).not.toBeNull()
    expect(itemMatches?.length).toBe(3)
    expect(rssContent).not.toContain('<link></link>')
    expect(result.success).toBe(true)
    expect(mockFsModule.writeFile).toHaveBeenCalledWith(rssPath, expect.any(String))
  })

  it('should generate RSS 2.0 feed with canonicalize=false', async () => {
    const app = new Hono()
    app.get('/', (c) =>
      c.html(
        `<html><head><title>Home Page</title><meta name="description" content="Welcome to the homepage." /></head><body><h1>Hello RSS!</h1></body></html>`
      )
    )
    app.get('/about', (c) =>
      c.html(
        `<html><head><title>About Page</title><meta name="description" content="About us page." /></head><body><h1>About</h1></body></html>`
      )
    )
    app.get('/blog/post-1/', (c) =>
      c.html(
        `<html><head><title>Blog Post 1</title><meta name="description" content="Description for blog post 1." /></head><body><h1>Blog Post 1</h1></body></html>`
      )
    )

    const plugin = rssPlugin({
      baseUrl: 'https://example.com',
      feedTitle: 'Test Feed',
      feedDescription: 'This is a test RSS feed.',
      feedType: 'rss2',
      canonicalize: false,
    })

    await toSSG(app, mockFsModule, {
      plugins: [plugin],
      dir: DEFAULT_OUTPUT_DIR,
    })

    const rssPath = path.join(DEFAULT_OUTPUT_DIR, 'rss.xml')
    const rssContent = writtenFiles[rssPath]
    expect(rssContent).toMatch(
      /<item>\s*<title>Home Page<\/title>\s*<link>https:\/\/example\.com\/<\/link>\s*<description>Welcome to the homepage\.<\/description>\s*<\/item>/
    )
    expect(rssContent).toMatch(
      /<item>\s*<title>About Page<\/title>\s*<link>https:\/\/example\.com\/about.html<\/link>\s*<description>About us page\.<\/description>\s*<\/item>/
    )
    expect(rssContent).toMatch(
      /<item>\s*<title>Blog Post 1<\/title>\s*<link>https:\/\/example\.com\/blog\/post-1\/<\/link>\s*<description>Description for blog post 1\.<\/description>\s*<\/item>/
    )
    expect(rssContent).not.toContain('<link></link>')
  })

  it('should handle special characters in URLs', async () => {
    const app = new Hono()
    app.get('/hello world', (c) =>
      c.html(
        `<html><head><title>Hello World</title><meta name="description" content="Hello world page." /></head><body><h1>Hello World!</h1></body></html>`
      )
    )
    app.get('/こんにちは', (c) =>
      c.html(
        `<html><head><title>こんにちは</title><meta name="description" content="Japanese greeting." /></head><body><h1>こんにちは</h1></body></html>`
      )
    )

    const plugin = rssPlugin({
      baseUrl: 'https://example.com',
      feedTitle: 'Test Feed',
      feedDescription: 'This is a test RSS feed.',
      feedType: 'rss2',
    })

    await toSSG(app, mockFsModule, {
      plugins: [plugin],
      dir: DEFAULT_OUTPUT_DIR,
    })

    const rssPath = path.join(DEFAULT_OUTPUT_DIR, 'rss.xml')
    const rssContent = writtenFiles[rssPath]
    expect(rssContent).toContain('https://example.com/hello%20world')
    expect(rssContent).toContain(
      'https://example.com/%E3%81%93%E3%82%93%E3%81%AB%E3%81%A1%E3%81%AF'
    )
  })

  it('should use custom output directory', async () => {
    const app = new Hono()
    app.get('/', (c) =>
      c.html(
        `<html><head><title>Home Page</title><meta name="description" content="Welcome to the homepage." /></head><body><h1>Hello RSS!</h1></body></html>`
      )
    )

    const plugin = rssPlugin({
      baseUrl: 'https://example.com',
      feedTitle: 'Test Feed',
      feedDescription: 'This is a test RSS feed.',
      feedType: 'rss2',
    })

    await toSSG(app, mockFsModule, {
      plugins: [plugin],
      dir: 'dist',
    })

    const rssPath = path.join('dist', 'rss.xml')
    expect(mockFsModule.writeFile).toHaveBeenCalledWith(rssPath, expect.any(String))
  })

  it('should handle empty file list', async () => {
    const app = new Hono()
    const plugin = rssPlugin({
      baseUrl: 'https://example.com',
      feedTitle: 'Test Feed',
      feedDescription: 'This is a test RSS feed.',
      feedType: 'rss2',
    })

    await toSSG(app, mockFsModule, {
      plugins: [plugin],
      dir: DEFAULT_OUTPUT_DIR,
    })

    const rssPath = path.join(DEFAULT_OUTPUT_DIR, 'rss.xml')
    const rssContent = writtenFiles[rssPath]
    expect(rssContent).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(rssContent).toContain('<rss version="2.0">')
    expect(rssContent).toContain('<channel>')
    expect(rssContent).toContain('</channel>')
    expect(rssContent).toContain('</rss>')
    const itemMatches = rssContent.match(/<item>[\s\S]*?<\/item>/g)
    expect(itemMatches).toBeNull()
  })

  it('should escape HTML elements in title and description', async () => {
    const app = new Hono()
    app.get('/danger', (c) =>
      c.html(
        `<html><head><title>Home <b>Page</b> &amp; <foo/></title><meta name="description" content="Description with <bar> &amp; <baz/>." /></head><body><h1>Danger!</h1></body></html>`
      )
    )

    const plugin = rssPlugin({
      baseUrl: 'https://example.com',
      feedTitle: 'My Blog & <News>',
      feedDescription: 'This is a blog about <coding> & programming.',
      feedType: 'rss2',
    })

    await toSSG(app, mockFsModule, {
      plugins: [plugin],
      dir: DEFAULT_OUTPUT_DIR,
    })

    const rssPath = path.join(DEFAULT_OUTPUT_DIR, 'rss.xml')
    const rssContent = writtenFiles[rssPath]
    expect(rssContent).toMatch(
      /<item>\s*<title>Home &lt;b&gt;Page&lt;\/b&gt; &amp;amp; &lt;foo\/&gt;<\/title>\s*<link>https:\/\/example\.com\/danger<\/link>\s*<description>Description with &lt;bar&gt; &amp;amp; &lt;baz\/&gt;\.<\/description>\s*<\/item>/
    )
  })
})
