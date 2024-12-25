import type { Enforcer } from 'casbin'
import type { Context } from 'hono'
import { decode } from 'hono/jwt'
import type { JWTPayload } from 'hono/utils/jwt/types'

export const jwtAuthorizer = async (
  c: Context,
  enforcer: Enforcer,
  claimMapping: Record<string, string> = { userID: 'sub' }
): Promise<boolean> => {
  // Note: if use hono/jwt, the payload is stored in c.get('jwtPayload')
  // https://github.com/honojs/hono/blob/8ba02273e829318d7f8797267f52229e531b8bd5/src/middleware/jwt/jwt.ts#L136
  let payload: JWTPayload = c.get('jwtPayload')

  if (!payload) {
    const credentials = c.req.header('Authorization')
    if (!credentials) {
      return false
    }

    const parts = credentials.split(/\s+/)
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return false
    }

    const token = parts[1]

    try {
      const decoded = decode(token)
      payload = decoded.payload
    } catch {
      return false
    }
  }

  const args = Object.values(claimMapping).map((key) => payload[key])

  const { path, method } = c.req
  return await enforcer.enforce(...args, path, method)
}
