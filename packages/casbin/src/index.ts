import { Enforcer } from 'casbin'
import { type Context, MiddlewareHandler } from 'hono'

interface CasbinOptions {
  newEnforcer: Promise<Enforcer>
  authorizer: (c: Context, enforcer: Enforcer) => Promise<boolean>
}

export const casbin = (opt: CasbinOptions): MiddlewareHandler => {
  return async (c, next) => {
    const enforcer = await opt.newEnforcer
    if (!(enforcer instanceof Enforcer)) {
      return c.json({ error: 'Invalid enforcer' }, 500)
    }

    const isAllowed = await opt.authorizer(c, enforcer)
    if (!isAllowed) {
      return c.json({ error: 'Forbidden' }, 403)
    }
    await next()
  }
}
