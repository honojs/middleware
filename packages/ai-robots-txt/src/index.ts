import { createMiddleware } from 'hono/factory'
import { escape } from './escape'
import { bots, botslist } from './robots'

/**
 * Converts a list of strings into a regular expression group.
 * Each string in the list is escaped using `RegExp.escape()` or polyfill
 * and then joined by a '|' (OR) operator. The entire result is wrapped in
 * parentheses to form a capturing group.
 *
 * @param list An array of strings to include in the regex.
 * @returns A string representing the PCRE-like regex group.
 */
function listToRegex(list: string[]): string {
  const formatted = list.map((item) => escape(item).toUpperCase()).join('|')
  return `(${formatted})`
}

export function blockAiBots(params = { allowRespecting: false }) {
  return createMiddleware(async (c, next) => {
    const userAgent = c.req.header('User-Agent')?.toUpperCase()

    if (!userAgent) {
      await next()
      return
    }

    let b = bots

    if (params.allowRespecting) {
      b = Object.fromEntries(botslist.filter(([, value]) => value.respect !== 'Yes'))
    }

    const userAgentRegex = listToRegex(Object.keys(b))

    if (!userAgent.match(userAgentRegex)) {
      await next()
      return
    }

    return c.text('Forbidden', 403)
  })
}

export function aiRobotsTxt() {
  const userAgentDirectives = Object.keys(bots)
    .map((key) => `User-agent: ${key}`)
    .join('\n')

  let robotsTxt = userAgentDirectives

  if (robotsTxt !== '') {
    robotsTxt += '\n'
  }
  robotsTxt += 'Disallow: /\n'

  return robotsTxt
}

export function useAiRobotsTxt() {
  const robots = aiRobotsTxt()
  return createMiddleware(async (c) => {
    return c.text(robots, 200)
  })
}
