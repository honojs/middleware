export type XScopes =
  | 'tweet.read'
  | 'tweet.write'
  | 'tweet.moderate.write'
  | 'users.read'
  | 'users.email'
  | 'follows.read'
  | 'follows.write'
  | 'offline.access'
  | 'space.read'
  | 'mute.read'
  | 'mute.write'
  | 'like.read'
  | 'like.write'
  | 'list.read'
  | 'list.write'
  | 'block.read'
  | 'block.write'
  | 'bookmark.read'
  | 'bookmark.write'
  | 'dm.read'
  | 'dm.write'
  | 'media.write'

export type XFields =
  | 'affiliation'
  | 'confirmed_email'
  | 'connection_status'
  | 'created_at'
  | 'description'
  | 'entities'
  | 'id'
  | 'is_identity_verified'
  | 'location'
  | 'most_recent_tweet_id'
  | 'name'
  | 'parody'
  | 'pinned_tweet_id'
  | 'profile_banner_url'
  | 'profile_image_url'
  | 'protected'
  | 'public_metrics'
  | 'receives_your_dm'
  | 'subscribes_to_you'
  | 'subscription'
  | 'subscription_type'
  | 'url'
  | 'username'
  | 'verified'
  | 'verified_followers_count'
  | 'verified_type'
  | 'withheld'

export type XErrorResponse = {
  error: string
  error_description: string
}

export type XTokenResponse = {
  access_token: string
  expires_in: number
  scope: string
  token_type: string
  refresh_token?: string
}

export type XMeResponse = {
  data: XUser
}

export type XRevokeResponse = {
  revoked: boolean
}

export type XUser = {
  affiliation: {
    badge_url: string
    description: string
    url: string
    user_id: string[]
  }
  confirmed_email: string
  connection_status: string[]
  created_at: string
  description: string
  entities: {
    url: {
      urls: {
        start: number
        end: number
        url: string
        expanded_url: string
        display_url: string
      }
    }
  }
  id: string
  is_identity_verified: boolean
  location: string
  most_recent_tweet_id: string
  name: string
  parody: boolean
  profile_banner_url: string
  profile_image_url: string
  protected: boolean
  public_metrics: {
    followers_count: number
    following_count: number
    tweet_count: number
    listed_count: number
    like_count: number
  }
  receives_your_dm: boolean
  subscribes_to_you: boolean
  subscription: {
    subscribes_to_you: boolean
  }
  subscription_type: string
  url: string
  username: string
  verified_type: string
  verified: boolean
  verified_followers_count: number
}
