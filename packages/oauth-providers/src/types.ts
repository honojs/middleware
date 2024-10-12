export type OAuthVariables = {
  token: Token | undefined
  'refresh-token': Token | undefined
  'granted-scopes': string[] | undefined
}

export type Token = {
  token: string
  expires_in?: number
}
