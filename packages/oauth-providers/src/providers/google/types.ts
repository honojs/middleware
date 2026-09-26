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
  refresh_token: string
  refresh_token_expires_in: number
  scope: string
  token_type: string
  id_token: string
}

export type GoogleTokenInfoResponse = {
  issued_to: string
  audience: string
  user_id: string
  scope: string
  expires_in: number
  email: string
  verified_email: boolean
  access_type: string
}

export type GoogleUser = {
  id: string
  email: string
  verified_email: boolean
  name: string
  given_name: string
  family_name: string
  picture: string
  locale: string
}

export type Token = {
  token: string
  expires_in: number
}
