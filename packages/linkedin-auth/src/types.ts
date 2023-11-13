export type LinkedinAuthVariables = {
  token: Token | undefined
  'refresh-token': Token | undefined
  'granted-scopes': string[] | undefined
  'user-linkedin': Partial<LinkedInUser> | undefined
}
export type Token = {
  token: string,
  expires_in: number
}
export type LinkedInScope =
  'profile' | 'email' | 'openid' | 'w_member_social' | 'rw_organization_admin' | 'r_organization_admin' |
  'w_organization_social' | 'r_organization_social' | 'w_member_social' | 'rw_ads' | 'r_ads' |
  'r_ads_reporting' | 'r_1st_connections_size' | 'r_basicprofile' | 'r_marketing_leadgen_automation' |
  'rw_dmp_segments' | 'r_sales_nav_analytics' | 'r_sales_nav_display' | 'r_sales_nav_validation' |
  'r_sales_nav_profiles' | 'r_compliance' | 'w_compliance'
export type LinkedInErrorResponse = {
  error: string,
  error_description: string
}
export type LinkedInTokenResponse = {
  access_token: string
  expires_in: number
  refresh_token: string
  refresh_token_expires_in: number
  scope?: string
} & LinkedInErrorResponse
export type LinkedInUser = {
  sub: string
  email_verified: boolean
  name: string
  locale: {
    country: string
    language: string
  },
  given_name: string
  family_name: string
  email: string
  picture: string
} & LinkedInErrorResponse