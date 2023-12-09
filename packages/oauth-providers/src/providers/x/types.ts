export type XScopes =
  | 'tweet.read'
  | 'tweet.write'
  | 'tweet.moderate.write'
  | 'users.read'
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

export type XFields =
  | 'created_at'
  | 'description'
  | 'entities'
  | 'id'
  | 'location'
  | 'most_recent_tweet_id'
  | 'name'
  | 'pinned_tweet_id'
  | 'profile_image_url'
  | 'protected'
  | 'public_metrics'
  | 'url'
  | 'username'
  | 'verified'
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
  location: string
  most_recent_tweet_id: string
  name: string
  profile_image_url: string
  protected: boolean
  public_metrics: {
    followers_count: number
    following_count: number
    tweet_count: number
    listed_count: number
    like_count: number
  }
  url: string
  username: string
  verified_type: string
  verified: boolean
}
