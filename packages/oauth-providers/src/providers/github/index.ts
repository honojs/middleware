import type { OAuthVariables } from '../../types'
import type { GitHubUser } from './types'
export { githubAuth } from './githubAuth'
export * from './types'

declare module 'hono' {
  interface ContextVariableMap extends OAuthVariables {
    'user-github': Partial<GitHubUser> | undefined
  }
}
