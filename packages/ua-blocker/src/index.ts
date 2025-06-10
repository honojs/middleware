import { createMiddleware } from 'hono/factory'
import { escape } from './escape'

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
  const formatted = list.map((item) => escape(item.toUpperCase())).join('|')
  return `(${formatted})`
}

/**
 *
 * @param params - `blocklist`: An array of user-agents to block.
 * @returns the Hono middleware to block requests based on User-Agent header.
 */
export function uaBlocker(params = { blocklist: [] as string[] }) {
  const regex = new RegExp(listToRegex(params.blocklist))

  return createMiddleware(async (c, next) => {
    const userAgent = c.req.header('User-Agent')?.toUpperCase()

    if (userAgent && params.blocklist.length > 0 && userAgent.match(regex)) {
      return c.text('Forbidden', 403)
    }

    await next()
    return
  })
}
