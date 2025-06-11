export { discordAuth } from './discordAuth.ts'
export { refreshToken } from './refreshToken.ts'
export { revokeToken } from './revokeToken.ts'
export * from './types.ts'
import type { OAuthVariables } from '../../types.ts'
import type { DiscordUser } from './types.ts'

declare module 'hono' {
  interface ContextVariableMap extends OAuthVariables {
    'user-discord': Partial<DiscordUser> | undefined
  }
}
