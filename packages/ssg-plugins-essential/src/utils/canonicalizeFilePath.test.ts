import { describe, it, expect } from 'vitest'
import { canonicalizeFilePath } from './canonicalizeFilePath'

describe('canonicalizeFilePath', () => {
  it('should return both routePath and url for index.html', () => {
    const result = canonicalizeFilePath(
      './static/about/index.html',
      './static',
      'https://example.com'
    )
    expect(result.routePath).toBe('/about/')
    expect(result.url).toBe('https://example.com/about/')
    const root = canonicalizeFilePath('static/index.html', 'static', 'https://example.com')
    expect(root.routePath).toBe('/')
    expect(root.url).toBe('https://example.com/')
  })

  it('should canonicalize .html extension when canonicalize=true', () => {
    const result = canonicalizeFilePath(
      './static/about.html',
      './static',
      'https://example.com',
      true
    )
    expect(result.routePath).toBe('/about')
    expect(result.url).toBe('https://example.com/about')
    const post = canonicalizeFilePath(
      'static/blog/post-1.html',
      'static',
      'https://example.com',
      true
    )
    expect(post.routePath).toBe('/blog/post-1')
    expect(post.url).toBe('https://example.com/blog/post-1')
  })

  it('should keep .html extension when canonicalize=false', () => {
    const result = canonicalizeFilePath(
      './static/about.html',
      './static',
      'https://example.com',
      false
    )
    expect(result.routePath).toBe('/about')
    expect(result.url).toBe('https://example.com/about.html')
    const post = canonicalizeFilePath(
      'static/blog/post-1.html',
      'static',
      'https://example.com',
      false
    )
    expect(post.routePath).toBe('/blog/post-1')
    expect(post.url).toBe('https://example.com/blog/post-1.html')
  })

  it('should encode special characters', () => {
    const jp = canonicalizeFilePath('./static/こんにちは.html', './static', 'https://example.com')
    expect(jp.routePath).toBe('/こんにちは')
    expect(jp.url).toBe('https://example.com/%E3%81%93%E3%82%93%E3%81%AB%E3%81%A1%E3%81%AF')
    const space = canonicalizeFilePath(
      './static/hello world.html',
      './static',
      'https://example.com'
    )
    expect(space.routePath).toBe('/hello world')
    expect(space.url).toBe('https://example.com/hello%20world')
  })

  it('should handle baseUrl with or without trailing slash', () => {
    const withSlash = canonicalizeFilePath(
      './static/about.html',
      './static',
      'https://example.com/',
      true
    )
    expect(withSlash.url).toBe('https://example.com/about')
    const withoutSlash = canonicalizeFilePath(
      './static/about.html',
      './static',
      'https://example.com',
      true
    )
    expect(withoutSlash.url).toBe('https://example.com/about')
  })

  it('should handle outputDir with or without leading ./ and trailing /', () => {
    const withDot = canonicalizeFilePath('./static/about.html', './static/', 'https://example.com')
    expect(withDot.url).toBe('https://example.com/about')
    const withoutDot = canonicalizeFilePath('static/about.html', 'static', 'https://example.com')
    expect(withoutDot.url).toBe('https://example.com/about')
  })

  it('should handle Windows-style paths', () => {
    const result = canonicalizeFilePath(
      '.\\static\\about\\index.html',
      './static',
      'https://example.com'
    )
    expect(result.routePath).toBe('/about/')
    expect(result.url).toBe('https://example.com/about/')

    const file = canonicalizeFilePath(
      'static\\blog\\post-1.html',
      './static',
      'https://example.com',
      true
    )
    expect(file.routePath).toBe('/blog/post-1')
    expect(file.url).toBe('https://example.com/blog/post-1')
  })
})
