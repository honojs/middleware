import { createMiddleware } from 'hono/factory'
import { escape } from './escape'

/**
 * Converts a list of strings into a regular expression group.
 * Each string in the list is escaped using `RegExp.escape()` or polyfill
 * and then joined by a '|' (OR) operator. The entire result is wrapped in
 * parentheses to form a capturing group.
 *
 * @param list An array of strings to include in the regex.
 * @returns A RegExp matching any of the strings in the capture group.
 */
function listToRegex(list: string[]): RegExp | undefined {
  let regex

  if (list.length > 0) {
    const formatted = list.map((item) => escape(item.toUpperCase())).join('|')
    regex = new RegExp(`(${formatted})`)
  }

  return regex
}

/**
 *
 * @param params - `blocklist`: An array of user-agents to block, or a RegExp to match against.
 * @returns the Hono middleware to block requests based on User-Agent header.
 */
export function uaBlocker(params = { blocklist: [] as string[] | RegExp }) {
  const regex = Array.isArray(params.blocklist) ? listToRegex(params.blocklist) : params.blocklist

  return createMiddleware(async (c, next) => {
    const userAgent = c.req.header('User-Agent')?.toUpperCase()

    if (userAgent && regex && userAgent.match(regex)) {
      return c.text('Forbidden', 403)
    }

    await next()
    return
  })
}
