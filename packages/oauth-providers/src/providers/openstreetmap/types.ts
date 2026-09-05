export type OpenStreetMapScope =
  | 'read_prefs'
  | 'write_prefs'
  | 'write_diary'
  | 'write_api'
  | 'write_changeset_comments'
  | 'read_gpx'
  | 'write_gpx'
  | 'write_notes'
  | 'write_redactions'
  | 'write_blocks'
  | 'consume_messages'
  | 'send_messages'
  // `read_email` is one of the privileged scopes, which OpenStreetMap only
  // offers to applications registered by a site administrator.
  | 'read_email'
  | 'openid'

export type OpenStreetMapErrorResponse = {
  error: string
  error_description: string
  state?: string
}

// OpenStreetMap access tokens do not expire and no refresh token is issued,
// so the response carries neither `expires_in` nor `refresh_token`.
export type OpenStreetMapTokenResponse = {
  access_token: string
  token_type: string
  scope: string
  created_at: number
}

export type OpenStreetMapUser = {
  id: number
  display_name: string
  account_created: string
  description?: string
  company?: string
  social_links: {
    url: string
    platform: string
  }[]
  contributor_terms: {
    agreed: boolean
    pd: boolean
  }
  img: {
    href?: string
  }
  roles: string[]
  changesets: {
    count: number
  }
  traces: {
    count: number
  }
  blocks: {
    received: {
      count: number
      active: number
    }
    // Only present for moderators.
    issued?: {
      count: number
      active: number
    }
  }
  home?: {
    lat: number
    lon: number
    zoom: number
  }
  languages?: string[]
  messages: {
    received: {
      count: number
      unread: number
    }
    sent: {
      count: number
    }
  }
  // Only present when the `read_email` scope was granted.
  email?: string
}

export type OpenStreetMapUserResponse = {
  version: string
  generator: string
  copyright: string
  attribution: string
  license: string
  user: OpenStreetMapUser
}
