export { googleAuth } from './googleAuth'
export { revokeToken } from './revokeToken'
export * from './types'
import type { OAuthVariables } from '../../types'
import type { GoogleUser } from './types'

declare module 'hono' {
  interface ContextVariableMap extends OAuthVariables {
    'user-google': Partial<GoogleUser> | undefined
  }
}
