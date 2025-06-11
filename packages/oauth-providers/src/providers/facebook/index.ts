import type { OAuthVariables } from '../../types.ts'
import type { FacebookUser } from './types.ts'
export { facebookAuth } from './facebookAuth.ts'
export * from './types.ts'

declare module 'hono' {
  interface ContextVariableMap extends OAuthVariables {
    'user-facebook': Partial<FacebookUser> | undefined
  }
}
