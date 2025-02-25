export { twitchAuth } from './twitchAuth'
export { refreshToken } from './refreshToken'
export { revokeToken } from './revokeToken'
export * from './types'
import type { OAuthVariables } from '../../types'
import type { TwitchUser } from './types'

declare module 'hono' {
  interface ContextVariableMap extends OAuthVariables {
    'user-twitch': Partial<TwitchUser> | undefined
  }
}
