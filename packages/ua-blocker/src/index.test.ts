import { Hono } from 'hono'
import { aiBots, nonRespectingAiBots } from './ai-bots'
import { uaBlocker } from './index'

describe('uaBlocker middleware', () => {
  const app = new Hono()

  // Custom blocklist test
  app.use(
    '/custom/*',
    uaBlocker({
      blocklist: ['BadBot', 'EvilCrawler', 'SpamBot'],
    })
  )
  app.get('/custom/test', (c) => c.text('custom'))

  // AI bots blocklist test
  app.use(
    '/ai/*',
    uaBlocker({
      blocklist: aiBots,
    })
  )
  app.get('/ai/test', (c) => c.text('ai'))

  // Non-respecting AI bots blocklist test
  app.use(
    '/non-respecting/*',
    uaBlocker({
      blocklist: nonRespectingAiBots,
    })
  )
  app.get('/non-respecting/test', (c) => c.text('non-respecting'))

  // Empty blocklist test
  app.use(
    '/empty/*',
    uaBlocker({
      blocklist: [],
    })
  )
  app.get('/empty/test', (c) => c.text('empty'))

  // Default parameters test (empty blocklist)
  app.use('/default/*', uaBlocker())
  app.get('/default/test', (c) => c.text('default'))

  // Custom RegExp test
  app.use(
    '/custom-regex/*',
    uaBlocker({
      blocklist: /BADREGEXBOT|EVILREGEXBOT/,
    })
  )
  app.get('/custom-regex/test', (c) => c.text('custom-regex'))

  describe('Custom blocklist', () => {
    it('Should block user agents in custom blocklist', async () => {
      const res = await app.request('http://localhost/custom/test', {
        headers: {
          'User-Agent': 'BadBot/1.0',
        },
      })
      expect(res.status).toBe(403)
      expect(await res.text()).toBe('Forbidden')
    })

    it('Should block user agents with case insensitive matching', async () => {
      const res = await app.request('http://localhost/custom/test', {
        headers: {
          'User-Agent': 'badbot/2.0',
        },
      })
      expect(res.status).toBe(403)
      expect(await res.text()).toBe('Forbidden')
    })

    it('Should block user agents with version info', async () => {
      const res = await app.request('http://localhost/custom/test', {
        headers: {
          'User-Agent': 'EvilCrawler/3.0 (compatible; MSIE 6.0)',
        },
      })
      expect(res.status).toBe(403)
      expect(await res.text()).toBe('Forbidden')
    })

    it('Should allow user agents not in blocklist', async () => {
      const res = await app.request('http://localhost/custom/test', {
        headers: {
          'User-Agent': 'GoodBot/1.0',
        },
      })
      expect(res.status).toBe(200)
      expect(await res.text()).toBe('custom')
    })

    it('Should allow regular browser user agents', async () => {
      const res = await app.request('http://localhost/custom/test', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      })
      expect(res.status).toBe(200)
      expect(await res.text()).toBe('custom')
    })
  })

  describe('AI bots blocklist', () => {
    it('Should block known AI bots from the list', async () => {
      const res = await app.request('http://localhost/ai/test', {
        headers: {
          'User-Agent': 'GPTBot/1.0',
        },
      })
      expect(res.status).toBe(403)
      expect(await res.text()).toBe('Forbidden')
    })

    it('Should block Bytespider (non-respecting bot)', async () => {
      const res = await app.request('http://localhost/ai/test', {
        headers: {
          'User-Agent': 'Bytespider',
        },
      })
      expect(res.status).toBe(403)
      expect(await res.text()).toBe('Forbidden')
    })

    it('Should block ClaudeBot', async () => {
      const res = await app.request('http://localhost/ai/test', {
        headers: {
          'User-Agent': 'ClaudeBot/1.0',
        },
      })
      expect(res.status).toBe(403)
      expect(await res.text()).toBe('Forbidden')
    })

    it('Should allow unknown bots not in the AI list', async () => {
      const res = await app.request('http://localhost/ai/test', {
        headers: {
          'User-Agent': 'UnknownBot/1.0',
        },
      })
      expect(res.status).toBe(200)
      expect(await res.text()).toBe('ai')
    })
  })

  describe('Non-respecting AI bots blocklist', () => {
    it('Should block non-respecting bots like Bytespider', async () => {
      const res = await app.request('http://localhost/non-respecting/test', {
        headers: {
          'User-Agent': 'Bytespider',
        },
      })
      expect(res.status).toBe(403)
      expect(await res.text()).toBe('Forbidden')
    })

    it('Should allow respecting bots like GPTBot', async () => {
      const res = await app.request('http://localhost/non-respecting/test', {
        headers: {
          'User-Agent': 'GPTBot',
        },
      })
      expect(res.status).toBe(200)
      expect(await res.text()).toBe('non-respecting')
    })

    it('Should allow ChatGPT-User (respecting bot)', async () => {
      const res = await app.request('http://localhost/non-respecting/test', {
        headers: {
          'User-Agent': 'ChatGPT-User',
        },
      })
      expect(res.status).toBe(200)
      expect(await res.text()).toBe('non-respecting')
    })
  })

  describe('Edge cases', () => {
    it('Should allow requests with no User-Agent header', async () => {
      const res = await app.request('http://localhost/custom/test')
      expect(res.status).toBe(200)
      expect(await res.text()).toBe('custom')
    })

    it('Should allow requests with empty User-Agent header', async () => {
      const res = await app.request('http://localhost/custom/test', {
        headers: {
          'User-Agent': '',
        },
      })
      expect(res.status).toBe(200)
      expect(await res.text()).toBe('custom')
    })

    it('Should allow all requests with empty blocklist', async () => {
      const res = await app.request('http://localhost/empty/test', {
        headers: {
          'User-Agent': 'AnyBot/1.0',
        },
      })
      expect(res.status).toBe(200)
      expect(await res.text()).toBe('empty')
    })

    it('Should allow all requests with explicit empty array blocklist', async () => {
      const emptyBlocklist: string[] = []
      const testApp = new Hono()
      testApp.use(uaBlocker({ blocklist: emptyBlocklist }))
      testApp.get('/', (c) => c.text('success'))

      const res = await testApp.request('/', {
        headers: {
          'User-Agent': 'BadBot/1.0',
        },
      })
      expect(res.status).toBe(200)
      expect(await res.text()).toBe('success')
    })

    it('Should allow all requests with default parameters (empty blocklist)', async () => {
      const res = await app.request('http://localhost/default/test', {
        headers: {
          'User-Agent': 'AnyBot/1.0',
        },
      })
      expect(res.status).toBe(200)
      expect(await res.text()).toBe('default')
    })
  })

  describe('Empty blocklist behavior tests', () => {
    it('Should handle empty blocklist without error', () => {
      const testApp = new Hono()
      const emptyMiddleware = uaBlocker({ blocklist: [] })
      testApp.use(emptyMiddleware)
      testApp.get('/', (c) => c.text('success'))

      // Implementation should not error when creating middleware with empty blocklist
      expect(emptyMiddleware).toBeDefined()
    })

    it('Should allow all user agents when blocklist is empty', async () => {
      const testApp = new Hono()
      testApp.use(uaBlocker({ blocklist: [] }))
      testApp.get('/', (c) => c.text('success'))

      const testBots = ['TestBot', 'CrawlerBot', 'BadBot']

      for (const bot of testBots) {
        const res = await testApp.request('/', {
          headers: { 'User-Agent': bot },
        })
        expect(res.status).toBe(200)
        expect(await res.text()).toBe('success')
      }
    })
  })

  describe('Custom RegExp blocklist', () => {
    it('Should block user agents matching the RegExp pattern', async () => {
      const res = await app.request('http://localhost/custom-regex/test', {
        headers: {
          'User-Agent': 'BadRegexBot/1.0',
        },
      })
      expect(res.status).toBe(403)
      expect(await res.text()).toBe('Forbidden')
    })

    it('Should block user agents with case insensitive matching', async () => {
      const res = await app.request('http://localhost/custom-regex/test', {
        headers: {
          'User-Agent': 'badregexbot/2.0',
        },
      })
      expect(res.status).toBe(403)
      expect(await res.text()).toBe('Forbidden')
    })

    it('Should allow user agents not matching the RegExp pattern', async () => {
      const res = await app.request('http://localhost/custom-regex/test', {
        headers: {
          'User-Agent': 'GoodBot/1.0',
        },
      })
      expect(res.status).toBe(200)
      expect(await res.text()).toBe('custom-regex')
    })
  })

  describe('Multiple bots validation', () => {
    const testCases = [
      { agent: 'AI2Bot', isNonRespecting: false },
      { agent: 'Bytespider', isNonRespecting: true },
      { agent: 'ChatGPT-User', isNonRespecting: false },
      { agent: 'ClaudeBot', isNonRespecting: false },
      { agent: 'GPTBot', isNonRespecting: false },
      { agent: 'CCBot', isNonRespecting: false },
      { agent: 'iaskspider/2.0', isNonRespecting: true },
    ]

    testCases.forEach(({ agent, isNonRespecting }) => {
      it(`Should handle ${agent} correctly (isNonRespecting: ${isNonRespecting})`, async () => {
        // Test with all AI bots
        const allRes = await app.request('http://localhost/ai/test', {
          headers: { 'User-Agent': agent },
        })
        expect(allRes.status).toBe(403)

        // Test with non-respecting bots only
        const nonRespectingRes = await app.request('http://localhost/non-respecting/test', {
          headers: { 'User-Agent': agent },
        })
        expect(nonRespectingRes.status).toBe(isNonRespecting ? 403 : 200)
      })
    })
  })
})
