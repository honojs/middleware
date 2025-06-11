import type { OAuthVariables } from '../../types.ts'
import type { LinkedInUser } from './types.ts'
export { linkedinAuth } from './linkedinAuth.ts'
export { refreshToken } from './refreshToken.ts'
export * from './types.ts'

declare module 'hono' {
  interface ContextVariableMap extends OAuthVariables {
    'user-linkedin': Partial<LinkedInUser> | undefined
  }
}
