import type { OAuthVariables } from '../../types'
import type { LinkedInUser } from './types'
export { linkedinAuth } from './linkedinAuth'
export { refreshToken } from './refreshToken'
export * from './types'

declare module 'hono' {
  interface ContextVariableMap extends OAuthVariables {
    'user-linkedin': Partial<LinkedInUser> | undefined
  }
}
