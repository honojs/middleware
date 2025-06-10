import { Hono } from 'hono'
import { aiBots, nonRespectingAiBots, AI_ROBOTS_TXT, useAiRobotsTxt } from './ai-bots'
import { ALL_BOTS, NON_RESPECTING_BOTS, ROBOTS_TXT } from './generated'

describe('AI Bots module', () => {
  describe('aiBots export', () => {
    it('Should export ALL_BOTS from generated', () => {
      expect(aiBots).toBe(ALL_BOTS)
    })

    it('Should be an array of strings', () => {
      expect(Array.isArray(aiBots)).toBe(true)
      expect(aiBots.length).toBeGreaterThan(0)
      aiBots.forEach((bot) => {
        expect(typeof bot).toBe('string')
        expect(bot.length).toBeGreaterThan(0)
      })
    })

    it('Should include known AI bots', () => {
      expect(aiBots).toContain('GPTBot')
      expect(aiBots).toContain('ClaudeBot')
      expect(aiBots).toContain('Bytespider')
      expect(aiBots).toContain('ChatGPT-User')
    })

    it('Should not contain duplicates', () => {
      const uniqueBots = [...new Set(aiBots)]
      expect(uniqueBots.length).toBe(aiBots.length)
    })
  })

  describe('nonRespectingAiBots export', () => {
    it('Should export NON_RESPECTING_BOTS from generated', () => {
      expect(nonRespectingAiBots).toBe(NON_RESPECTING_BOTS)
    })

    it('Should be an array of strings', () => {
      expect(Array.isArray(nonRespectingAiBots)).toBe(true)
      expect(nonRespectingAiBots.length).toBeGreaterThan(0)
      nonRespectingAiBots.forEach((bot) => {
        expect(typeof bot).toBe('string')
        expect(bot.length).toBeGreaterThan(0)
      })
    })

    it('Should be a subset of aiBots', () => {
      nonRespectingAiBots.forEach((bot) => {
        expect(aiBots).toContain(bot)
      })
    })

    it('Should include known non-respecting bots', () => {
      expect(nonRespectingAiBots).toContain('Bytespider')
      expect(nonRespectingAiBots).toContain('ClaudeBot')
    })

    it('Should not include known respecting bots', () => {
      expect(nonRespectingAiBots).not.toContain('GPTBot')
      expect(nonRespectingAiBots).not.toContain('ChatGPT-User')
    })

    it('Should be smaller than aiBots list', () => {
      expect(nonRespectingAiBots.length).toBeLessThan(aiBots.length)
    })
  })

  describe('AI_ROBOTS_TXT export', () => {
    it('Should export ROBOTS_TXT from generated', () => {
      expect(AI_ROBOTS_TXT).toBe(ROBOTS_TXT)
    })

    it('Should be a non-empty string', () => {
      expect(typeof AI_ROBOTS_TXT).toBe('string')
      expect(AI_ROBOTS_TXT.length).toBeGreaterThan(0)
    })

    it('Should contain User-agent directives', () => {
      expect(AI_ROBOTS_TXT).toContain('User-agent:')
    })

    it('Should contain Disallow directive', () => {
      expect(AI_ROBOTS_TXT).toContain('Disallow: /')
    })

    it('Should have proper robots.txt format', () => {
      const lines = AI_ROBOTS_TXT.split('\n')
      const userAgentLines = lines.filter((line) => line.startsWith('User-agent:'))
      const disallowIndex = lines.findIndex((line) => line === 'Disallow: /')

      expect(userAgentLines.length).toBeGreaterThan(0)
      expect(disallowIndex).toBeGreaterThan(0)
      expect(lines[lines.length - 1]).toBe('')
    })

    it('Should include all AI bots', () => {
      aiBots.forEach((bot) => {
        expect(AI_ROBOTS_TXT).toContain(`User-agent: ${bot}`)
      })
    })
  })

  describe('useAiRobotsTxt function', () => {
    it('Should return a function', () => {
      const middleware = useAiRobotsTxt()
      expect(typeof middleware).toBe('function')
    })

    it('Should create working Hono middleware', async () => {
      const app = new Hono()
      app.use('/robots.txt', useAiRobotsTxt())

      const res = await app.request('/robots.txt')
      expect(res.status).toBe(200)
    })

    it('Should serve the correct robots.txt content', async () => {
      const app = new Hono()
      app.use('/robots.txt', useAiRobotsTxt())

      const res = await app.request('/robots.txt')
      const content = await res.text()

      expect(content).toBe(AI_ROBOTS_TXT)
    })

    it('Should set correct content type', async () => {
      const app = new Hono()
      app.use('/robots.txt', useAiRobotsTxt())

      const res = await app.request('/robots.txt')
      expect(res.headers.get('Content-Type')).toBe('text/plain; charset=UTF-8')
    })

    it('Should work with different paths', async () => {
      const app = new Hono()
      app.use('/custom-robots.txt', useAiRobotsTxt())
      app.use('/api/robots.txt', useAiRobotsTxt())

      const res1 = await app.request('/custom-robots.txt')
      const res2 = await app.request('/api/robots.txt')

      expect(res1.status).toBe(200)
      expect(res2.status).toBe(200)
      expect(await res1.text()).toBe(AI_ROBOTS_TXT)
      expect(await res2.text()).toBe(AI_ROBOTS_TXT)
    })

    it('Should not interfere with other routes', async () => {
      const app = new Hono()
      app.use('/robots.txt', useAiRobotsTxt())
      app.get('/other', (c) => c.text('other content'))
      app.get('/api/data', (c) => c.json({ data: 'test' }))

      const robotsRes = await app.request('/robots.txt')
      const otherRes = await app.request('/other')
      const apiRes = await app.request('/api/data')

      expect(robotsRes.status).toBe(200)
      expect(await robotsRes.text()).toBe(AI_ROBOTS_TXT)

      expect(otherRes.status).toBe(200)
      expect(await otherRes.text()).toBe('other content')

      expect(apiRes.status).toBe(200)
      expect(await apiRes.json()).toEqual({ data: 'test' })
    })

    it('Should handle requests with different methods', async () => {
      const app = new Hono()
      app.use('/robots.txt', useAiRobotsTxt())

      // GET request
      const getRes = await app.request('/robots.txt', { method: 'GET' })
      expect(getRes.status).toBe(200)
      expect(await getRes.text()).toBe(AI_ROBOTS_TXT)

      // HEAD request
      const headRes = await app.request('/robots.txt', { method: 'HEAD' })
      expect(headRes.status).toBe(200)
      expect(headRes.headers.get('Content-Type')).toBe('text/plain; charset=UTF-8')

      // POST request should also work since it's middleware
      const postRes = await app.request('/robots.txt', { method: 'POST' })
      expect(postRes.status).toBe(200)
      expect(await postRes.text()).toBe(AI_ROBOTS_TXT)
    })

    it('Should serve consistent content across multiple requests', async () => {
      const app = new Hono()
      app.use('/robots.txt', useAiRobotsTxt())

      const requests = Array.from({ length: 5 }, () => app.request('/robots.txt'))
      const responses = await Promise.all(requests)
      const contents = await Promise.all(responses.map((res) => res.text()))

      responses.forEach((res) => {
        expect(res.status).toBe(200)
        expect(res.headers.get('Content-Type')).toBe('text/plain; charset=UTF-8')
      })

      contents.forEach((content) => {
        expect(content).toBe(AI_ROBOTS_TXT)
      })

      // All contents should be identical
      const uniqueContents = [...new Set(contents)]
      expect(uniqueContents.length).toBe(1)
    })
  })

  describe('Integration tests', () => {
    it('Should work together with uaBlocker middleware', async () => {
      // This test ensures the ai-bots module integrates well with the main uaBlocker
      const { uaBlocker } = await import('./index')

      const app = new Hono()
      app.use('/robots.txt', useAiRobotsTxt())
      app.use('*', uaBlocker({ blocklist: nonRespectingAiBots }))
      app.get('/', (c) => c.text('Hello World'))

      // Should serve robots.txt
      const robotsRes = await app.request('/robots.txt')
      expect(robotsRes.status).toBe(200)
      expect(await robotsRes.text()).toBe(AI_ROBOTS_TXT)

      // Should block non-respecting bots
      const blockedRes = await app.request('/', {
        headers: { 'User-Agent': 'Bytespider' },
      })
      expect(blockedRes.status).toBe(403)

      // Should allow respecting bots
      const allowedRes = await app.request('/', {
        headers: { 'User-Agent': 'GPTBot' },
      })
      expect(allowedRes.status).toBe(200)
      expect(await allowedRes.text()).toBe('Hello World')
    })

    it('Should work with demo pattern', async () => {
      const { uaBlocker } = await import('./index')

      const app = new Hono()
      app.use('*', uaBlocker({ blocklist: nonRespectingAiBots }))
      app.use('/robots.txt', useAiRobotsTxt())
      app.get('/', (c) => c.text('Hello World'))

      // Test the same pattern as shown in demo.ts
      const robotsRes = await app.request('/robots.txt')
      expect(robotsRes.status).toBe(200)
      expect(robotsRes.headers.get('Content-Type')).toBe('text/plain; charset=UTF-8')

      const homeRes = await app.request('/')
      expect(homeRes.status).toBe(200)
      expect(await homeRes.text()).toBe('Hello World')
    })
  })

  describe('Data consistency validation', () => {
    it('Should have robots.txt that matches bot lists', () => {
      const userAgentLines = AI_ROBOTS_TXT.split('\n')
        .filter((line) => line.startsWith('User-agent:'))
        .map((line) => line.replace('User-agent: ', ''))

      expect(userAgentLines.sort()).toEqual(aiBots.sort())
    })
  })
})
