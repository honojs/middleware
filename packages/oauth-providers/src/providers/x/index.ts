export { xAuth } from './xAuth.ts'
export { refreshToken } from './refreshToken.ts'
export { revokeToken } from './revokeToken.ts'
export * from './types.ts'
import type { OAuthVariables } from '../../types.ts'
import type { XUser } from './types.ts'

declare module 'hono' {
  interface ContextVariableMap extends OAuthVariables {
    'user-x': Partial<XUser> | undefined
  }
}
