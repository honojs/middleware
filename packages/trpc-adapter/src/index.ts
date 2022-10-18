import type { Handler } from 'hono'

export const trpcAdapter = (): Handler => {
  return async (_c, next) => {
    await next()
  }
}
