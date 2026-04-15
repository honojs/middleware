import { Hono } from 'hono'
import { describe, it, expect, vi } from 'vitest'
import { markdown } from './index'
import type { MiddlewareOptions } from './index'

// ---------------------------------------------------------------------------
// Test harness helpers
// ---------------------------------------------------------------------------

function createMockContext(
  acceptHeader: string,
  responseBody: string,
  responseContentType: string
) {
  const resHeaders = new Headers({
    'content-type': responseContentType,
  })

  const context = {
    req: {
      header: (name: string): string | undefined => {
        if (name === 'accept') {
          return acceptHeader
        }
        return undefined
      },
    },
    res: new Response(responseBody, { headers: resHeaders }),
  }

  return context
}

type MockContext = ReturnType<typeof createMockContext>

interface HeaderTestHarness {
  send: (
    options: MiddlewareOptions | undefined,
    accept: string,
    contentType: string,
    body: string,
    extraHeaders?: Record<string, string>
  ) => Promise<{ getHeader: (name: string) => string | null | undefined }>
}

const honoHarness: HeaderTestHarness = {
  async send(options, accept, contentType, body, extraHeaders) {
    const mw = markdown(options)
    const resHeaders = new Headers({ 'content-type': contentType })
    if (extraHeaders) {
      for (const [k, v] of Object.entries(extraHeaders)) {
        resHeaders.set(k, v)
      }
    }
    const c: MockContext = {
      req: {
        header: (name: string): string | undefined => {
          if (name === 'accept') {
            return accept
          }
          return undefined
        },
      },
      res: new Response(body, { headers: resHeaders }),
    }
    const next = vi.fn().mockResolvedValue(undefined)
    // @ts-expect-error -- mock context is intentionally partial
    await mw(c, next)
    return { getHeader: (name: string) => c.res.headers.get(name) }
  },
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

describe('hono middleware', () => {
  it('converts HTML to markdown when Accept: text/markdown', async () => {
    const mw = markdown()
    const c = createMockContext('text/markdown', '<h1>Title</h1><p>Body</p>', 'text/html')

    const next = vi.fn().mockResolvedValue(undefined)
    // @ts-expect-error -- mock context is intentionally partial
    await mw(c, next)

    const body = await c.res.text()
    expect(body).toContain('# Title')
    expect(body).toContain('Body')
    expect(c.res.headers.get('content-type')).toBe('text/markdown; charset=utf-8')
    expect(c.res.headers.get('x-markdown-tokens')).toBeTruthy()
  })

  it('passes through when Accept is not text/markdown', async () => {
    const mw = markdown()
    const c = createMockContext('text/html', '<h1>Title</h1>', 'text/html')

    const next = vi.fn().mockResolvedValue(undefined)
    // @ts-expect-error -- mock context is intentionally partial
    await mw(c, next)

    expect(next).toHaveBeenCalled()
  })

  it('passes through non-HTML responses', async () => {
    const mw = markdown()
    const c = createMockContext('text/markdown', '{"ok":true}', 'application/json')

    const next = vi.fn().mockResolvedValue(undefined)
    // @ts-expect-error -- mock context is intentionally partial
    await mw(c, next)

    expect(c.res.headers.get('content-type')).toBe('application/json')
  })

  it('supports custom token header', async () => {
    const mw = markdown({ tokenHeader: 'x-tokens' })
    const c = createMockContext('text/markdown', '<p>Hello</p>', 'text/html')

    const next = vi.fn().mockResolvedValue(undefined)
    // @ts-expect-error -- mock context is intentionally partial
    await mw(c, next)

    expect(c.res.headers.get('x-tokens')).toBeTruthy()
    expect(c.res.headers.get('x-markdown-tokens')).toBeNull()
  })

  describe('ETag header', () => {
    it('sets ETag on converted responses', async () => {
      const mw = markdown()
      const c = createMockContext('text/markdown', '<h1>Title</h1>', 'text/html')

      const next = vi.fn().mockResolvedValue(undefined)
      // @ts-expect-error -- mock context is intentionally partial
      await mw(c, next)

      expect(c.res.headers.get('etag')).toMatch(/^".+"$/)
    })

    it('does not set ETag on pass-through responses', async () => {
      const mw = markdown()
      const c = createMockContext('text/html', '<h1>Title</h1>', 'text/html')

      const next = vi.fn().mockResolvedValue(undefined)
      // @ts-expect-error -- mock context is intentionally partial
      await mw(c, next)

      expect(c.res.headers.get('etag')).toBeNull()
    })
  })

  // -----------------------------------------------------------------------
  // Content-Signal header
  // -----------------------------------------------------------------------

  describe('Content-Signal header', () => {
    it('sets content-signal on converted responses when configured', async () => {
      const { getHeader } = await honoHarness.send(
        { contentSignal: { aiTrain: true, search: true, aiInput: true } },
        'text/markdown',
        'text/html',
        '<h1>Title</h1>'
      )
      expect(getHeader('content-signal')).toBe('ai-train=yes, search=yes, ai-input=yes')
    })

    it('does not set content-signal when not configured', async () => {
      const { getHeader } = await honoHarness.send(
        undefined,
        'text/markdown',
        'text/html',
        '<h1>Title</h1>'
      )
      expect(getHeader('content-signal')).toBeFalsy()
    })

    it('does not set content-signal on pass-through responses', async () => {
      const { getHeader } = await honoHarness.send(
        { contentSignal: { aiTrain: true } },
        'text/html',
        'text/html',
        '<h1>Title</h1>'
      )
      expect(getHeader('content-signal')).toBeFalsy()
    })
  })

  // -----------------------------------------------------------------------
  // Server-Timing header
  // -----------------------------------------------------------------------

  describe('Server-Timing header', () => {
    it('includes mfa.convert timing when serverTiming is enabled', async () => {
      const { getHeader } = await honoHarness.send(
        { serverTiming: true },
        'text/markdown',
        'text/html',
        '<h1>Title</h1>'
      )
      const timing = getHeader('server-timing')
      expect(timing).toMatch(/mfa\.convert;dur=[\d.]+;desc="HTML to Markdown"/)
    })

    it('does not set Server-Timing when serverTiming is disabled', async () => {
      const { getHeader } = await honoHarness.send(
        undefined,
        'text/markdown',
        'text/html',
        '<h1>Title</h1>'
      )
      expect(getHeader('server-timing')).toBeFalsy()
    })

    it('does not set Server-Timing on pass-through responses', async () => {
      const { getHeader } = await honoHarness.send(
        { serverTiming: true },
        'text/html',
        'text/html',
        '<h1>Title</h1>'
      )
      expect(getHeader('server-timing')).toBeFalsy()
    })
  })

  describe('x-markdown-timing header', () => {
    it('sets x-markdown-timing alongside Server-Timing when serverTiming is enabled', async () => {
      const { getHeader } = await honoHarness.send(
        { serverTiming: true },
        'text/markdown',
        'text/html',
        '<h1>Title</h1>'
      )
      const timing = getHeader('x-markdown-timing')
      expect(timing).toMatch(/mfa\.convert;dur=[\d.]+;desc="HTML to Markdown"/)
    })

    it('does not set x-markdown-timing when serverTiming is disabled', async () => {
      const { getHeader } = await honoHarness.send(
        undefined,
        'text/markdown',
        'text/html',
        '<h1>Title</h1>'
      )
      expect(getHeader('x-markdown-timing')).toBeFalsy()
    })

    it('does not set x-markdown-timing on pass-through responses', async () => {
      const { getHeader } = await honoHarness.send(
        { serverTiming: true },
        'text/html',
        'text/html',
        '<h1>Title</h1>'
      )
      expect(getHeader('x-markdown-timing')).toBeFalsy()
    })

    it('uses custom timingHeader name when provided', async () => {
      const { getHeader } = await honoHarness.send(
        { serverTiming: true, timingHeader: 'x-custom-timing' },
        'text/markdown',
        'text/html',
        '<h1>Title</h1>'
      )
      expect(getHeader('x-custom-timing')).toMatch(
        /mfa\.convert;dur=[\d.]+;desc="HTML to Markdown"/
      )
      expect(getHeader('x-markdown-timing')).toBeFalsy()
    })
  })

  // -----------------------------------------------------------------------
  // Vary header
  // -----------------------------------------------------------------------

  describe('Vary header', () => {
    it('sets Vary: Accept on converted responses', async () => {
      const { getHeader } = await honoHarness.send(
        undefined,
        'text/markdown',
        'text/html',
        '<h1>Title</h1>'
      )
      expect(getHeader('vary')).toContain('Accept')
    })

    it('sets Vary: Accept on pass-through responses', async () => {
      const { getHeader } = await honoHarness.send(
        undefined,
        'text/html',
        'text/html',
        '<h1>Title</h1>'
      )
      expect(getHeader('vary')).toContain('Accept')
    })

    it('appends to existing Vary header', async () => {
      const { getHeader } = await honoHarness.send(
        undefined,
        'text/markdown',
        'text/html',
        '<h1>Title</h1>',
        { vary: 'Accept-Encoding' }
      )
      const vary = getHeader('vary') ?? ''
      expect(vary).toContain('Accept-Encoding')
      expect(vary).toContain('Accept')
    })
  })
})

// ---------------------------------------------------------------------------
// Integration tests
// ---------------------------------------------------------------------------

function createApp(options?: Parameters<typeof markdown>[0]) {
  const app = new Hono()
  app.use('*', markdown(options))

  app.get('/html', (c) => {
    return c.html('<h1>Hello World</h1><p>This is <strong>bold</strong> text.</p>')
  })

  app.get('/json', (c) => {
    return c.json({ message: 'hello' })
  })

  app.get('/page', (c) => {
    return c.html(`
        <nav><a href="/">Home</a></nav>
        <main><h1>Article</h1><p>Content here.</p></main>
        <footer>Copyright</footer>
      `)
  })

  return app
}

describe('hono middleware integration', () => {
  it('converts HTML to markdown via Hono request', async () => {
    const app = createApp()
    const res = await app.request('/html', {
      headers: { accept: 'text/markdown' },
    })
    const body = await res.text()

    expect(res.headers.get('content-type')).toBe('text/markdown; charset=utf-8')
    expect(body).toContain('# Hello World')
    expect(body).toContain('**bold**')

    const tokens = Number(res.headers.get('x-markdown-tokens'))
    expect(tokens).toBeGreaterThan(0)
  })

  it('returns HTML when Accept header does not request markdown', async () => {
    const app = createApp()
    const res = await app.request('/html', {
      headers: { accept: 'text/html' },
    })
    const body = await res.text()

    expect(res.headers.get('content-type')).toContain('text/html')
    expect(body).toContain('<h1>')
  })

  it('does not interfere with JSON responses', async () => {
    const app = createApp()
    const res = await app.request('/json', {
      headers: { accept: 'text/markdown' },
    })
    const data: unknown = await res.json()

    expect(data).toEqual({ message: 'hello' })
  })

  it('supports extraction via options', async () => {
    const app = createApp({ extract: true })
    const res = await app.request('/page', {
      headers: { accept: 'text/markdown' },
    })
    const body = await res.text()

    expect(body).toContain('Article')
    expect(body).toContain('Content here.')
    expect(body).not.toContain('Home')
    expect(body).not.toContain('Copyright')
  })
})
