import type { Enforcer } from 'casbin'
import type { Context } from 'hono'
import { auth } from 'hono/utils/basic-auth'

const getUserName = (c: Context): string => {
  const requestUser = auth(c.req.raw)
  if (!requestUser) {
    return ''
  }
  return requestUser.username
}

export const basicAuthorizer = async (c: Context, enforcer: Enforcer): Promise<boolean> => {
  const { path, method } = c.req
  const user = getUserName(c)
  return enforcer.enforce(user, path, method)
}
