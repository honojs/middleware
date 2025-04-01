export type Scopes =
  // Analytics
  | 'analytics:read:extensions'
  | 'analytics:read:games'

  // Bits
  | 'bits:read'

  // Channel
  | 'channel:bot'
  | 'channel:manage:ads'
  | 'channel:read:ads'
  | 'channel:manage:broadcast'
  | 'channel:read:charity'
  | 'channel:edit:commercial'
  | 'channel:read:editors'
  | 'channel:manage:extensions'
  | 'channel:read:goals'
  | 'channel:read:guest_star'
  | 'channel:manage:guest_star'
  | 'channel:read:hype_train'
  | 'channel:manage:moderators'
  | 'channel:read:polls'
  | 'channel:manage:polls'
  | 'channel:read:predictions'
  | 'channel:manage:predictions'
  | 'channel:manage:raids'
  | 'channel:read:redemptions'
  | 'channel:manage:redemptions'
  | 'channel:manage:schedule'
  | 'channel:read:stream_key'
  | 'channel:read:subscriptions'
  | 'channel:manage:videos'
  | 'channel:read:vips'
  | 'channel:manage:vips'
  | 'channel:moderate'

  // Clips
  | 'clips:edit'

  // User
  | 'user:bot'
  | 'user:edit'
  | 'user:edit:broadcast'
  | 'user:read:blocked_users'
  | 'user:manage:blocked_users'
  | 'user:read:broadcast'
  | 'user:read:chat'
  | 'user:manage:chat_color'
  | 'user:read:email'
  | 'user:read:emotes'
  | 'user:read:follows'
  | 'user:read:moderated_channels'
  | 'user:read:subscriptions'
  | 'user:read:whispers'
  | 'user:manage:whispers'
  | 'user:write:chat'

  // Moderation
  | 'moderation:read'
  | 'moderator:manage:announcements'
  | 'moderator:manage:automod'
  | 'moderator:read:automod_settings'
  | 'moderator:manage:automod_settings'
  | 'moderator:read:banned_users'
  | 'moderator:manage:banned_users'
  | 'moderator:read:blocked_terms'
  | 'moderator:read:chat_messages'
  | 'moderator:manage:blocked_terms'
  | 'moderator:manage:chat_messages'
  | 'moderator:read:chat_settings'
  | 'moderator:manage:chat_settings'
  | 'moderator:read:chatters'
  | 'moderator:read:followers'
  | 'moderator:read:guest_star'
  | 'moderator:manage:guest_star'
  | 'moderator:read:moderators'
  | 'moderator:read:shield_mode'
  | 'moderator:manage:shield_mode'
  | 'moderator:read:shoutouts'
  | 'moderator:manage:shoutouts'
  | 'moderator:read:suspicious_users'
  | 'moderator:read:unban_requests'
  | 'moderator:manage:unban_requests'
  | 'moderator:read:vips'
  | 'moderator:read:warnings'
  | 'moderator:manage:warnings'

  // IRC Chat Scopes
  | 'chat:edit'
  | 'chat:read'

  // PubSub-specific Chat Scopes
  | 'whispers:read'

// Error responses types from Twitch API
export type TwitchErrorResponse = {
  error?: string
  error_description?: string
  state?: string
  message?: string
  status?: number
}

export type TwitchValidateError = Required<Pick<TwitchErrorResponse, 'status' | 'message'>>

export type TwitchRevokingError = Required<Pick<TwitchErrorResponse, 'status' | 'message'>>

export type TwitchRefreshError = Required<Pick<TwitchErrorResponse, 'status' | 'message' | 'error'>>

export type TwitchTokenError = Required<Pick<TwitchErrorResponse, 'status' | 'message' | 'error'>>

// Success responses types from Twitch API
export interface TwitchValidateSuccess {
  client_id: string
  login: string
  scopes: Scopes[]
  user_id: string
  expires_in: number
}

export interface TwitchRevokingSuccess {
  status?: number
}

export interface TwitchRefreshSuccess {
  access_token: string
  expires_in: number
  refresh_token: string
  scope: Scopes[]
  token_type: string
}

export interface TwitchTokenSuccess {
  access_token: string
  expires_in: number
  refresh_token: string
  scope: Scopes[]
  token_type: string
}

// Combined response types
export type TwitchRevokingResponse = TwitchRevokingSuccess | TwitchRevokingError

export type TwitchRefreshResponse = TwitchRefreshSuccess | TwitchRefreshError

export type TwitchTokenResponse = TwitchTokenSuccess | TwitchTokenError

export type TwitchValidateResponse = TwitchValidateSuccess | TwitchValidateError

export interface TwitchUserResponse {
  data: [
    {
      id: string
      login: string
      display_name: string
      type: string
      broadcaster_type: string
      description: string
      profile_image_url: string
      offline_image_url: string
      view_count: number
      email: string
      created_at: string
    }
  ]
}

export type TwitchUser = TwitchUserResponse['data'][0]
