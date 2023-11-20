import type { OAuthVariables } from '../../types'
import type { FacebookUser } from './types'
export { facebookAuth } from './facebookAuth'
export * from './types'

declare module 'hono' {
  interface ContextVariableMap extends OAuthVariables {
    'user-facebook': Partial<FacebookUser> | undefined
  }
}
