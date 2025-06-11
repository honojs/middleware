export { msentraAuth } from './msentraAuth.ts'
export { refreshToken } from './refreshToken.ts'
export * from './types.ts'
import type { OAuthVariables } from '../../types.ts'
import type { MSEntraUser } from './types.ts'

declare module 'hono' {
  interface ContextVariableMap extends OAuthVariables {
    'user-msentra': Partial<MSEntraUser> | undefined
  }
}
