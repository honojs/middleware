import { Context, MiddlewareHandler } from 'hono'
import { env } from 'hono/adapter'
import { verify } from 'hono/jwt'

// add supabse jwt type infer
interface SupabaseJWTPayload<T extends object = object> {
  iss: string
  sub: string
  aud: string
  exp: number
  iat: number
  user_metadata: { sub: string } & T
  role: string
  amr: [{ method: string; timestamp: number }]
  session_id: string
  is_anonymous: boolean
  aal: string
  email: string
  phone: string
}
declare module 'hono' {
  interface ContextVariableMap {
    auth: SupabaseJWTPayload
  }
}
type SupabaseEnv = {
  SUPABASE_JWT_SECRET: string
}

export const getSupabaseAuth = <T extends object = object>(c: Context) => {
  const payload = c.get('supabaseAuth') as { auth: SupabaseJWTPayload<T>; token: string }
  return payload
}

export const checkToken = (supabase?: string): MiddlewareHandler => {
  return async (c, next) => {
    const secret = supabase ?? env<SupabaseEnv>(c).SUPABASE_JWT_SECRET
    const token = c.req.header('Authorization')

    if (!token) return c.json({ message: 'token is required' }, 401)
    const jwt = token.split(' ').at(-1)
    if (!jwt) return c.json({ message: 'token is invalid' }, 401)

    try {
      const payload = (await verify(jwt, secret)) as unknown as SupabaseJWTPayload
      c.set('supabaseAuth', { auth: payload, token: jwt })
      await next()
    } catch (e) {
      return c.json({ message: 'jwt is invalid' }, 401)
    }
  }
}
