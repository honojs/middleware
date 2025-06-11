import type { Token } from '../../types.ts'

export type MSEntraErrorResponse = {
  error: string
  error_description: string
  error_codes: number[]
}

export type MSEntraTokenResponse = {
  access_token: string
  expires_in: number
  scope: string
  token_type: string
  id_token: string
  refresh_token: string
}

export type MSEntraUser = {
  id: string
  upn: string
  verified_email: boolean
  name: string
  given_name: string
  family_name: string
  picture: string
  local: string
  employeeId: string
}

export type MSEntraToken = Token & {
  refresh_token?: string
}
