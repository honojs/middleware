import type { FacebookUser } from './providers/facebook'
import type { GitHubUser } from './providers/github'
import type { GoogleUser } from './providers/google'
import type { LinkedInUser } from './providers/linkedin'

export type OAuthVariables = {
  token: Token | undefined
  'refresh-token': Token | undefined
  'granted-scopes': string[] | undefined
  'user-facebook': Partial<FacebookUser> | undefined
  'user-google': Partial<GoogleUser> | undefined
  'user-github': Partial<GitHubUser> | undefined
  'user-linkedin': Partial<LinkedInUser> | undefined
}

export type Token = {
  token: string
  expires_in: number
}
