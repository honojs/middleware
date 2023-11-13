export type GoogleAuthVariables = {
  token: Token | undefined
  'granted-scopes': string[] | undefined
  'user-google': Partial<GoogleUser> | undefined
}
export type Token = {
  token: string,
  expires_in: number
}
export type GoogleErrorResponse = {
  error?: {
    code: number
    message: string
    status: string
  }
  error_description: string
}
export type GoogleTokenResponse = {
  access_token: string
  expires_in: number
  scope: string
  token_type: string
  id_token: string
} & GoogleErrorResponse
export type GoogleTokenInfoResponse = {
  issued_to: string
  audience: string
  user_id: string
  scope: string
  expires_in: number
  email: string
  verified_email: boolean
  access_type: string
} & GoogleErrorResponse
export type GoogleUser = {
  id: string,
  email: string
  verified_email: boolean
  name: string
  given_name: string
  family_name: string
  picture: string
  locale: string
} & GoogleErrorResponse