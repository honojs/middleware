export { xAuth } from './xAuth'
export { refreshToken } from './refreshToken'
export { revokeToken } from './revokeToken'
export * from './types'
import type { OAuthVariables } from '../../types'
import type { XUser } from './types'

declare module 'hono' {
  interface ContextVariableMap extends OAuthVariables {
    'user-x': Partial<XUser> | undefined
  }
}
