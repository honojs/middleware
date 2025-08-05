import { Hono } from 'hono'
import { DEFAULT_OUTPUT_DIR, toSSG } from 'hono/ssg'
import type { FileSystemModule } from 'hono/ssg'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import path from 'node:path'
import { sitemapPlugin } from './sitemap'

describe('Sitemap Plugin', () => {
  let mockFsModule: FileSystemModule
  let writtenFiles: Record<string, string>

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

  it('should generate sitemap.xml with canonicalize=true (default)', async () => {
    const app = new Hono()
    app.get('/', (c) => c.html('<html><head><title>Home</title></head><body>Home</body></html>'))
    app.get('/about', (c) =>
      c.html('<html><head><title>About</title></head><body>About</body></html>')
    )
    app.get('/blog/post-1', (c) =>
      c.html('<html><head><title>Post</title></head><body>Post</body></html>')
    )
    const plugin = sitemapPlugin({ baseUrl: 'https://example.com' })

    await toSSG(app, mockFsModule, {
      plugins: [plugin],
      dir: DEFAULT_OUTPUT_DIR,
    })

    const expectedPath = path.join(DEFAULT_OUTPUT_DIR, 'sitemap.xml')
    expect(mockFsModule.writeFile).toHaveBeenCalledWith(expectedPath, expect.any(String))

    const sitemapContent = writtenFiles[expectedPath]
    expect(sitemapContent).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(sitemapContent).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(sitemapContent).toContain('<url><loc>https://example.com/</loc></url>')
    expect(sitemapContent).toContain('<url><loc>https://example.com/about</loc></url>')
    expect(sitemapContent).toContain('<url><loc>https://example.com/blog/post-1</loc></url>')
    expect(sitemapContent).toContain('</urlset>')
  })

  it('should generate sitemap.xml with canonicalize=false', async () => {
    const app = new Hono()
    app.get('/', (c) => c.html('<html><body>Home</body></html>'))
    app.get('/about', (c) => c.html('<html><body>About</body></html>'))
    app.get('/blog/post-1', (c) => c.html('<html><body>Post</body></html>'))

    const plugin = sitemapPlugin({ baseUrl: 'https://example.com', canonicalize: false })
    await toSSG(app, mockFsModule, { plugins: [plugin], dir: DEFAULT_OUTPUT_DIR })

    const expectedPath = path.join(DEFAULT_OUTPUT_DIR, 'sitemap.xml')
    const sitemapContent = writtenFiles[expectedPath]
    expect(sitemapContent).toContain('<url><loc>https://example.com/</loc></url>')
    expect(sitemapContent).toContain('<url><loc>https://example.com/about.html</loc></url>')
    expect(sitemapContent).toContain('<url><loc>https://example.com/blog/post-1.html</loc></url>')
  })

  it('should use custom output directory from options', async () => {
    const app = new Hono()
    app.get('/', (c) => c.html('<html><head><title>Home</title></head><body>Home</body></html>'))
    const plugin = sitemapPlugin({ baseUrl: 'https://example.com' })

    await toSSG(app, mockFsModule, {
      plugins: [plugin],
      dir: 'dist',
    })

    expect(mockFsModule.writeFile).toHaveBeenCalledWith('dist/sitemap.xml', expect.any(String))
  })

  it('should handle empty file list', async () => {
    const app = new Hono()
    const plugin = sitemapPlugin({ baseUrl: 'https://example.com' })

    await toSSG(app, mockFsModule, {
      plugins: [plugin],
      dir: DEFAULT_OUTPUT_DIR,
    })

    const expectedPath = path.join(DEFAULT_OUTPUT_DIR, 'sitemap.xml')
    const sitemapContent = writtenFiles[expectedPath]
    expect(sitemapContent).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(sitemapContent).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(sitemapContent).toContain('</urlset>')

    const urlMatches = sitemapContent.match(/<url>/g)
    expect(urlMatches).toBeNull()
  })

  it('should handle special characters in URLs', async () => {
    const app = new Hono()
    app.get('/hello world', (c) =>
      c.html('<html><head><title>Hello</title></head><body>Hello</body></html>')
    )
    app.get('/こんにちは', (c) =>
      c.html('<html><head><title>こんにちは</title></head><body>こんにちは</body></html>')
    )
    const plugin = sitemapPlugin({ baseUrl: 'https://example.com' })

    await toSSG(app, mockFsModule, {
      plugins: [plugin],
      dir: DEFAULT_OUTPUT_DIR,
    })

    const expectedPath = path.join(DEFAULT_OUTPUT_DIR, 'sitemap.xml')
    const sitemapContent = writtenFiles[expectedPath]

    expect(sitemapContent).toContain('https://example.com/hello%20world')
    expect(sitemapContent).toContain(
      'https://example.com/%E3%81%93%E3%82%93%E3%81%AB%E3%81%A1%E3%81%AF'
    )
  })

  it('should handle baseUrl with subdirectory', async () => {
    const app = new Hono()
    app.get('/', (c) => c.html('<html><head><title>Home</title></head><body>Home</body></html>'))
    const plugin = sitemapPlugin({ baseUrl: 'https://example.com/blog' })

    await toSSG(app, mockFsModule, {
      plugins: [plugin],
      dir: DEFAULT_OUTPUT_DIR,
    })

    const expectedPath = path.join(DEFAULT_OUTPUT_DIR, 'sitemap.xml')
    const sitemapContent = writtenFiles[expectedPath]

    expect(sitemapContent).toContain('<url><loc>https://example.com/blog/</loc></url>')
  })

  it('should handle baseUrl with trailing slash', async () => {
    const app = new Hono()
    app.get('/', (c) => c.html('<html><head><title>Home</title></head><body>Home</body></html>'))
    const plugin = sitemapPlugin({ baseUrl: 'https://example.com/blog/' })
    await toSSG(app, mockFsModule, {
      plugins: [plugin],
      dir: DEFAULT_OUTPUT_DIR,
    })

    const expectedPath = path.join(DEFAULT_OUTPUT_DIR, 'sitemap.xml')
    const sitemapContent = writtenFiles[expectedPath]

    expect(sitemapContent).toContain('<url><loc>https://example.com/blog/</loc></url>')
  })

  it('should not remove DEFAULT_OUTPUT_DIR from route path if it is part of the route', async () => {
    const app = new Hono()
    const normalizedDir = DEFAULT_OUTPUT_DIR.replace(/^\.\//, '').replace(/\/$/, '')
    app.get(`/${normalizedDir}/about`, (c) =>
      c.html('<html><head><title>Static About</title></head><body>Static About</body></html>')
    )
    const plugin = sitemapPlugin({ baseUrl: 'https://example.com' })

    await toSSG(app, mockFsModule, {
      plugins: [plugin],
      dir: DEFAULT_OUTPUT_DIR,
    })

    const expectedPath = path.join(DEFAULT_OUTPUT_DIR, 'sitemap.xml')
    const sitemapContent = writtenFiles[expectedPath]

    const expectedUrl = `<url><loc>https://example.com/${path.posix.join(normalizedDir, 'about')}</loc></url>`
    expect(sitemapContent).toContain(expectedUrl)
  })
})
