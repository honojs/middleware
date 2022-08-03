import type { Handler } from 'hono'

export const hello = (): Handler => {
  return async (c, next) => {
    await next()
  }
}
