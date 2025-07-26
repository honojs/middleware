import { DEFAULT_OUTPUT_DIR } from 'hono/ssg'
import type { FileSystemModule, ToSSGOptions, SSGPlugin, ToSSGResult } from 'hono/ssg'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import path from 'node:path'
import { robotsTxtPlugin } from './robots-txt'

const executeAfterGenerateHook = async (
  hook: SSGPlugin['afterGenerateHook'],
  result: ToSSGResult,
  fsModule: FileSystemModule,
  options?: ToSSGOptions
) => {
  if (Array.isArray(hook)) {
    for (const h of hook) {
      await h(result, fsModule, options)
    }
  } else if (hook) {
    await hook(result, fsModule, options)
  }
}

describe('robotsTxtPlugin', () => {
  let mockFsModule: FileSystemModule
  let writtenFiles: Record<string, string>
  let dummyResult: ToSSGResult

  beforeEach(() => {
    writtenFiles = {}
    dummyResult = { success: true, files: [] }
    mockFsModule = {
      writeFile: vi.fn((path: string, data: string | Uint8Array) => {
        writtenFiles[path] = typeof data === 'string' ? data : data.toString()
        return Promise.resolve()
      }),
      mkdir: vi.fn(() => Promise.resolve()),
    }
  })

  it('should generate robots.txt with default rule', async () => {
    const plugin = robotsTxtPlugin()
    await executeAfterGenerateHook(plugin.afterGenerateHook, dummyResult, mockFsModule)
    const expectedPath = path.join(DEFAULT_OUTPUT_DIR, 'robots.txt')
    expect(mockFsModule.writeFile).toHaveBeenCalledWith(expectedPath, expect.any(String))
    const content = writtenFiles[expectedPath]
    expect(content).toContain('User-agent: *')
  })

  it('should generate robots.txt with custom rules', async () => {
    const plugin = robotsTxtPlugin({
      rules: [
        { userAgent: 'Googlebot', allow: ['/'], disallow: ['/private/'] },
        { userAgent: 'Bingbot', disallow: ['/'] },
      ],
    })
    await executeAfterGenerateHook(plugin.afterGenerateHook, dummyResult, mockFsModule)
    const expectedPath = path.join(DEFAULT_OUTPUT_DIR, 'robots.txt')
    const content = writtenFiles[expectedPath]
    expect(content).toContain('User-agent: Googlebot')
    expect(content).toContain('Allow: /')
    expect(content).toContain('Disallow: /private/')
    expect(content).toContain('User-agent: Bingbot')
    expect(content).toContain('Disallow: /')
  })

  it('should include sitemap line', async () => {
    const plugin = robotsTxtPlugin({
      sitemapUrl: 'https://example.com/sitemap.xml',
    })
    await executeAfterGenerateHook(plugin.afterGenerateHook, dummyResult, mockFsModule)
    const expectedPath = path.join(DEFAULT_OUTPUT_DIR, 'robots.txt')
    const content = writtenFiles[expectedPath]
    expect(content).toContain('Sitemap: https://example.com/sitemap.xml')
  })

  it('should include extra lines', async () => {
    const plugin = robotsTxtPlugin({
      extraLines: ['# Extra comment', 'Crawl-delay: 10'],
    })
    await executeAfterGenerateHook(plugin.afterGenerateHook, dummyResult, mockFsModule)
    const expectedPath = path.join(DEFAULT_OUTPUT_DIR, 'robots.txt')
    const content = writtenFiles[expectedPath]
    expect(content).toContain('# Extra comment')
    expect(content).toContain('Crawl-delay: 10')
  })

  it('should use custom output directory', async () => {
    const plugin = robotsTxtPlugin()
    const options: ToSSGOptions = { dir: 'dist' }
    await executeAfterGenerateHook(plugin.afterGenerateHook, dummyResult, mockFsModule, options)
    expect(mockFsModule.writeFile).toHaveBeenCalledWith('dist/robots.txt', expect.any(String))
  })
})
