import type { OAuthVariables } from '../../types.ts'
import type { GitHubUser } from './types.ts'
export { githubAuth } from './githubAuth.ts'
export * from './types.ts'

declare module 'hono' {
  interface ContextVariableMap extends OAuthVariables {
    'user-github': Partial<GitHubUser> | undefined
  }
}
