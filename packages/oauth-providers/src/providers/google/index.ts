export { googleAuth } from './googleAuth.ts'
export { revokeToken } from './revokeToken.ts'
export * from './types.ts'
import type { OAuthVariables } from '../../types.ts'
import type { GoogleUser } from './types.ts'

declare module 'hono' {
  interface ContextVariableMap extends OAuthVariables {
    'user-google': Partial<GoogleUser> | undefined
  }
}
