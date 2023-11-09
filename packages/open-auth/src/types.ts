import type { FacebookUser } from './service/facebook'
import type { GoogleUser } from './service/google'

export type OpenAuthVariables = {
  token: Token | undefined
  'refresh-token': Token | undefined
  'granted-scopes': string[] | undefined
  'user-facebook': Partial<FacebookUser> | undefined
  'user-google': Partial<GoogleUser> | undefined
}

export type Token = {
  token: string,
  expires_in: number
}