import type { Enforcer } from 'casbin'
import type { Context } from 'hono'
import type { JWTPayload } from 'hono/utils/jwt/types'

export const jwtAuthorizer = async (
  c: Context,
  enforcer: Enforcer,
  claimMapping: Record<string, string> = { userID: 'sub' }
): Promise<boolean> => {
  // Only a payload that the JWT middleware of `hono/jwt` has verified is used.
  const payload = c.get('jwtPayload') as JWTPayload | undefined

  if (!payload) {
    return false
  }

  const args = Object.values(claimMapping).map((key) => payload[key])

  const { path, method } = c.req
  return await enforcer.enforce(...args, path, method)
}
