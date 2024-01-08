export type Scopes =
  | 'activities.read'
  | 'activities.write'
  | 'applications.builds.read'
  | 'applications.builds.upload'
  | 'applications.commands'
  | 'applications.commands.update'
  | 'applications.commands.permissions.update'
  | 'applications.entitlements'
  | 'applications.store.update'
  | 'bot'
  | 'connections'
  | 'dm_channels.read'
  | 'email'
  | 'gdm.join'
  | 'guilds'
  | 'guilds.join'
  | 'guilds.members.read'
  | 'identify'
  | 'messages.read'
  | 'relationships.read'
  | 'role_connections.write'
  | 'rpc'
  | 'rpc.activities.write'
  | 'rpc.notifications.read'
  | 'rpc.voice.read'
  | 'rpc.voice.write'
  | 'voice'
  | 'webhook.incoming'

export type DiscordErrorResponse = {
  message?: string
  code?: number
  error?: string
  error_description?: string
}

export type DiscordTokenResponse = {
  token_type: string
  access_token: string
  expires_in: number
  refresh_token: string
  scope: string
}

export interface DiscordMeResponse {
  application: {
    id: string
    name: string
    icon: string | null
    description: string
    type: string
    bot: {
      id: string
      username: string
      avatar: string | null
      discriminator: string
      public_flags: number
      premium_type: number
      flags: number
      bot: boolean
      banner: string | null
      accent_color: string | null
      global_name: string | null
      avatar_decoration_data: string | null
      banner_color: string | null
    }
    summary: string
    bot_public: boolean
    bot_require_code_grant: boolean
    verify_key: string
    flags: number
    hook: boolean
    is_monetized: boolean
  }
  expires: string
  scopes: string[]
  user: DiscordUser
}

export interface DiscordUser {
  id: string
  username: string
  avatar: string
  discriminator: string
  public_flags: number
  premium_type: number
  flags: number
  banner: string | null
  accent_color: string | null
  global_name: string
  avatar_decoration_data: string | null
  banner_color: string | null
}
