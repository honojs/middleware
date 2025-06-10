import { ROBOTS_TXT, ALL_BOTS, NON_RESPECTING_BOTS } from './generated'

describe('Generated constants', () => {
  describe('ROBOTS_TXT', () => {
    it('Should be a non-empty string', () => {
      expect(typeof ROBOTS_TXT).toBe('string')
      expect(ROBOTS_TXT.length).toBeGreaterThan(0)
    })

    it('Should contain User-agent directives', () => {
      const userAgentLines = ROBOTS_TXT.split('\n').filter((line) => line.startsWith('User-agent:'))
      expect(userAgentLines.length).toBeGreaterThan(0)
    })

    it('Should contain Disallow directive', () => {
      expect(ROBOTS_TXT).toContain('Disallow: /')
    })

    it('Should end with proper format', () => {
      const lines = ROBOTS_TXT.split('\n')
      expect(lines.at(-2)).toBe('Disallow: /')
      expect(lines.at(-1)).toBe('')
    })

    it('Should have User-agent lines before Disallow line', () => {
      const lines = ROBOTS_TXT.split('\n')
      const userAgentLines = lines.filter((line) => line.startsWith('User-agent:'))
      const disallowLineIndex = lines.findIndex((line) => line === 'Disallow: /')

      expect(userAgentLines.length).toBeGreaterThan(0)
      expect(disallowLineIndex).toBeGreaterThan(0)

      // All User-agent lines should come before Disallow
      lines.forEach((line, index) => {
        if (line.startsWith('User-agent:')) {
          expect(index).toBeLessThan(disallowLineIndex)
        }
      })
    })

    it('Should match ALL_BOTS list', () => {
      const userAgentLines = ROBOTS_TXT.split('\n').filter((line) => line.startsWith('User-agent:'))
      const botsInRobotsTxt = userAgentLines.map((line) => line.replace('User-agent: ', ''))

      expect(botsInRobotsTxt.sort()).toEqual(ALL_BOTS.sort())
    })

    it('Should match expected robots.txt conventions', () => {
      // Should not have any empty User-agent directives
      const userAgentLines = ROBOTS_TXT.split('\n').filter((line) => line.startsWith('User-agent:'))
      userAgentLines.forEach((line) => {
        expect(line.length).toBeGreaterThan('User-agent: '.length)
        expect(line.replace('User-agent: ', '').trim().length).toBeGreaterThan(0)
      })

      // Should have exactly one Disallow: / directive
      const disallowLines = ROBOTS_TXT.split('\n').filter((line) => line === 'Disallow: /')
      expect(disallowLines.length).toBe(1)
    })
  })

  describe('ALL_BOTS', () => {
    it('Should be an array', () => {
      expect(Array.isArray(ALL_BOTS)).toBe(true)
    })

    it('Should contain bot names', () => {
      expect(ALL_BOTS.length).toBeGreaterThan(0)
      ALL_BOTS.forEach((bot) => {
        expect(typeof bot).toBe('string')
        expect(bot.length).toBeGreaterThan(0)
      })
    })

    it('Should not contain duplicates', () => {
      const uniqueBots = [...new Set(ALL_BOTS)]
      expect(uniqueBots.length).toBe(ALL_BOTS.length)
    })

    it('Should contain only non-empty strings', () => {
      ALL_BOTS.forEach((bot) => {
        expect(typeof bot).toBe('string')
        expect(bot.trim().length).toBeGreaterThan(0)
        expect(bot).toBe(bot.trim()) // No leading/trailing whitespace
      })
    })
  })

  describe('NON_RESPECTING_BOTS', () => {
    it('Should be an array', () => {
      expect(Array.isArray(NON_RESPECTING_BOTS)).toBe(true)
    })

    it('Should contain bot names', () => {
      expect(NON_RESPECTING_BOTS.length).toBeGreaterThan(0)
      NON_RESPECTING_BOTS.forEach((bot) => {
        expect(typeof bot).toBe('string')
        expect(bot.length).toBeGreaterThan(0)
      })
    })

    it('Should be a subset of ALL_BOTS', () => {
      NON_RESPECTING_BOTS.forEach((bot) => {
        expect(ALL_BOTS).toContain(bot)
      })
    })

    it('Should be smaller than or equal to ALL_BOTS', () => {
      expect(NON_RESPECTING_BOTS.length).toBeLessThanOrEqual(ALL_BOTS.length)
    })

    it('Should include expected non-respecting bots', () => {
      expect(NON_RESPECTING_BOTS).toContain('Bytespider')
      expect(NON_RESPECTING_BOTS).toContain('ClaudeBot')
    })

    it('Should not include known respecting bots', () => {
      expect(NON_RESPECTING_BOTS).not.toContain('GPTBot')
      expect(NON_RESPECTING_BOTS).not.toContain('ChatGPT-User')
    })

    it('Should not contain duplicates', () => {
      const uniqueBots = [...new Set(NON_RESPECTING_BOTS)]
      expect(uniqueBots.length).toBe(NON_RESPECTING_BOTS.length)
    })

    it('Should contain only non-empty strings', () => {
      NON_RESPECTING_BOTS.forEach((bot) => {
        expect(typeof bot).toBe('string')
        expect(bot.trim().length).toBeGreaterThan(0)
        expect(bot).toBe(bot.trim()) // No leading/trailing whitespace
      })
    })
  })
})
