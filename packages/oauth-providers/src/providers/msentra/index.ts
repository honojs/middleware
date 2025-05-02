export { msentraAuth } from './msentraAuth'
export { refreshToken } from './refreshToken'
export * from './types'
import type { OAuthVariables } from '../../types'
import type { MSEntraUser } from './types'

declare module 'hono' {
  interface ContextVariableMap extends OAuthVariables {
    'user-msentra': Partial<MSEntraUser> | undefined
  }
}
