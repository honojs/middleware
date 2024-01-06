export { discordAuth } from './discordAuth'
export { refreshToken } from './refreshToken'
export { revokeToken } from './revokeToken'
export * from './types'
import type { OAuthVariables } from '../../types'
import type { DiscordUser } from './types'

declare module 'hono' {
  interface ContextVariableMap extends OAuthVariables {
    'user-discord': Partial<DiscordUser> | undefined
  }
}
