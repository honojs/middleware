import { decode } from 'hono/jwt'
import type { Enforcer } from 'casbin'
import type { Context } from 'hono'
import type { JWTPayload } from 'hono/utils/jwt/types'

export const jwtAuthorizer = async (
  c: Context,
  enforcer: Enforcer,
  claimMapping: Record<string, string>
): Promise<boolean> => {
  const credentials = c.req.header('Authorization')
  if (!credentials) return false

  const parts = credentials.split(/\s+/)
  if (parts.length !== 2 || parts[0] !== 'Bearer') return false

  const token = parts[1]
  let payload: JWTPayload

  try {
    const decoded = decode(token)
    payload = decoded.payload
  } catch {
    return false
  }

  const args = Object.values(claimMapping).map((key) => payload[key])

  const { path, method } = c.req
  return await enforcer.enforce(...args, path, method)
}
