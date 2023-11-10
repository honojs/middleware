import type { FacebookUser } from './service/facebook'
import type { GithubUser } from './service/github'
import type { GoogleUser } from './service/google'
import type { LinkedInUser } from './service/linkedIn'

export type OpenAuthVariables = {
  token: Token | undefined
  'refresh-token': Token | undefined
  'granted-scopes': string[] | undefined
  'user-facebook': Partial<FacebookUser> | undefined
  'user-google': Partial<GoogleUser> | undefined
  'user-github': Partial<GithubUser> | undefined
  'user-linkedin': Partial<LinkedInUser> | undefined
}

export type Token = {
  token: string,
  expires_in: number
}