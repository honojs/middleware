import { Hono } from 'hono'
import { aiRobotsTxt, blockAiBots, useAiRobotsTxt } from '.'

describe('AI Robots Txt blockAiBots middleware', () => {
  const app = new Hono()

  // Default configuration - blocks all non-respecting bots
  app.use('/hello/*', blockAiBots())
  app.get('/hello/foo', (c) => c.text('foo'))

  // Only blocks known non-respecting bots
  app.use('/x/*', blockAiBots({ allowRespecting: true }))
  app.get('/x/foo', (c) => c.text('foo'))

  // Test different paths to ensure middleware works on all routes
  app.use('/api/*', blockAiBots())
  app.get('/api/data', (c) => c.text('data'))

  describe('Default configuration (blocks all non-respecting bots)', () => {
    it('Should block known non-respecting bots', async () => {
      const res = await app.request('http://localhost/hello/foo', {
        headers: {
          'User-Agent': 'Bytespider',
        },
      })
      expect(res.status).toBe(403)
      expect(await res.text()).toBe('Forbidden')
    })

    it('Should not block bots that are not in the list (unknown bots)', async () => {
      const res = await app.request('http://localhost/hello/foo', {
        headers: {
          'User-Agent': 'UnknownBot/1.0',
        },
      })
      expect(res.status).toBe(200)
      expect(await res.text()).toBe('foo')
    })

    it('Should allow known respecting bots', async () => {
      const res = await app.request('http://localhost/hello/foo', {
        headers: {
          'User-Agent': 'Googlebot',
        },
      })
      expect(res.status).toBe(200)
      expect(await res.text()).toBe('foo')
    })

    it('Should allow regular browsers', async () => {
      const res = await app.request('http://localhost/hello/foo', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      })
      expect(res.status).toBe(200)
      expect(await res.text()).toBe('foo')
    })
  })

  describe('NonRespectingOnly configuration', () => {
    it('Should block known non-respecting bots', async () => {
      const res = await app.request('http://localhost/x/foo', {
        headers: {
          'User-Agent': 'Bytespider',
        },
      })
      expect(res.status).toBe(403)
      expect(await res.text()).toBe('Forbidden')
    })

    it('Should allow unknown bots', async () => {
      const res = await app.request('http://localhost/x/foo', {
        headers: {
          'User-Agent': 'UnknownBot/1.0',
        },
      })
      expect(res.status).toBe(200)
      expect(await res.text()).toBe('foo')
    })

    it('Should allow known respecting bots', async () => {
      const res = await app.request('http://localhost/x/foo', {
        headers: {
          'User-Agent': 'GPTBot',
        },
      })
      expect(res.status).toBe(200)
      expect(await res.text()).toBe('foo')
    })
  })

  describe('Edge cases', () => {
    it('Should allow requests with no User-Agent header', async () => {
      const res = await app.request('http://localhost/hello/foo')
      expect(res.status).toBe(200)
      expect(await res.text()).toBe('foo')
    })

    it('Should allow requests with empty User-Agent header', async () => {
      const res = await app.request('http://localhost/hello/foo', {
        headers: {
          'User-Agent': '',
        },
      })
      expect(res.status).toBe(200)
      expect(await res.text()).toBe('foo')
    })

    it('Should block non-respecting bots with different case in User-Agent', async () => {
      const res = await app.request('http://localhost/hello/foo', {
        headers: {
          'User-Agent': 'BYTESPIDER',
        },
      })
      expect(res.status).toBe(403)
      expect(await res.text()).toBe('Forbidden')
    })

    it('Should block non-respecting bots with additional version info', async () => {
      const res = await app.request('http://localhost/hello/foo', {
        headers: {
          'User-Agent': 'Bytespider/1.0',
        },
      })
      expect(res.status).toBe(403)
      expect(await res.text()).toBe('Forbidden')
    })
  })

  describe('Test multiple bots from robots.json', () => {
    const testCases = [
      { agent: 'ChatGPT-User', shouldBlock: false },
      { agent: 'Claude-User', shouldBlock: true },
      { agent: 'Applebot', shouldBlock: true },
      { agent: 'CCBot', shouldBlock: true },
      { agent: 'PetalBot', shouldBlock: false },
      { agent: 'Diffbot', shouldBlock: true },
    ]

    testCases.forEach(({ agent, shouldBlock }) => {
      it(`Should ${shouldBlock ? 'block' : 'allow'} ${agent}`, async () => {
        const res = await app.request('http://localhost/x/foo', {
          headers: {
            'User-Agent': agent,
          },
        })
        expect(res.status).toBe(shouldBlock ? 403 : 200)
        expect(await res.text()).toBe(shouldBlock ? 'Forbidden' : 'foo')
      })
    })
  })

  describe('aiRobotsTxt helper', () => {
    describe('Default configuration (all bots)', () => {
      const robotsTxt = aiRobotsTxt()

      it('Should include all known bots', () => {
        expect(robotsTxt).toContain('User-agent: Bytespider')
        expect(robotsTxt).toContain('User-agent: GPTBot')
        expect(robotsTxt).toContain('User-agent: ChatGPT-User')
        expect(robotsTxt).toContain('User-agent: CCBot')
      })

      it('Should have correct format', () => {
        const lines = robotsTxt.split('\n')

        // Should start with User-agent directives
        expect(lines[0]).toMatch(/^User-agent: /)

        // Should end with Disallow directive
        expect(lines[lines.length - 2]).toBe('Disallow: /')

        // Should end with a newline
        expect(lines[lines.length - 1]).toBe('')
      })

      it('Should have a Disallow directive after User-agent directives', () => {
        const lines = robotsTxt.split('\n')
        const lastUserAgentIndex =
          lines
            .map((line, index) => (line.startsWith('User-agent:') ? index : -1))
            .filter((index) => index !== -1)
            .pop() ?? -1
        const disallowIndex = lines.findIndex((line) => line === 'Disallow: /')

        expect(lastUserAgentIndex).toBeLessThan(disallowIndex)
      })
    })

    describe('aiRobotsTxt middleware', () => {
      describe('Default configuration (all bots)', () => {
        const app = new Hono()

        // Default configuration - blocks all non-respecting bots
        app.use('/robots.txt', useAiRobotsTxt())

        it('Should serve robots.txt', async () => {
          const robotsTxt = aiRobotsTxt()
          const res = await app.request('/robots.txt')
          expect(res.status).toBe(200)
          expect(res.body).toBeDefined()
          expect(res.headers.get('Content-Type')).toBe('text/plain; charset=UTF-8')
          expect(await res.text()).toEqual(robotsTxt)
        })

        it('Should have correct format', async () => {
          const res = await app.request('/robots.txt')
          const robotsTxt = await res.text()
          const lines = robotsTxt.split('\n')

          // Should start with User-agent directives
          expect(lines[0]).toMatch(/^User-agent: /)

          // Should end with Disallow directive
          expect(lines[lines.length - 2]).toBe('Disallow: /')

          // Should end with a newline
          expect(lines[lines.length - 1]).toBe('')
        })

        it('Should have a Disallow directive after User-agent directives', async () => {
          const res = await app.request('/robots.txt')
          const robotsTxt = await res.text()
          const lines = robotsTxt.split('\n')
          const lastUserAgentIndex =
            lines
              .map((line, index) => (line.startsWith('User-agent:') ? index : -1))
              .filter((index) => index !== -1)
              .pop() ?? -1
          const disallowIndex = lines.findIndex((line) => line === 'Disallow: /')

          expect(lastUserAgentIndex).toBeLessThan(disallowIndex)
        })
      })
    })
  })
})
