export { twitchAuth } from './twitchAuth.ts'
export { refreshToken } from './refreshToken.ts'
export { revokeToken } from './revokeToken.ts'
export { validateToken } from './validateToken.ts'
export * from './types.ts'
import type { OAuthVariables } from '../../types.ts'
import type { TwitchUser } from './types.ts'

declare module 'hono' {
  interface ContextVariableMap extends OAuthVariables {
    'user-twitch': Partial<TwitchUser> | undefined
  }
}
