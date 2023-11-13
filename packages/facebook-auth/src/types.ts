export type FacebookAuthVariables = {
  token: Token | undefined
  'granted-scopes': string[] | undefined
  'user-facebook': Partial<FacebookUser> | undefined
}

export type Token = {
  token: string,
  expires_in: number
}

export type FacebookResponseType = 'code' | 'token' | 'code%20token'

export type Permissions =
  'ads_management' | 'ads_read' | 'attribution_read' | 'business_management' |
  'catalog_management' | 'email' | 'gaming_user_locale' | 'groups_access_member_info' |
  'instagram_basic' | 'instagram_content_publish' | 'instagram_graph_user_media' |
  'instagram_graph_user_profile' | 'instagram_manage_comments' | 'instagram_manage_insights' |
  'instagram_manage_messages' | 'instagram_shopping_tag_products' | 'leads_retrieval' |
  'manage_fundraisers' | 'pages_events' | 'pages_manage_ads' | 'pages_manage_cta' |
  'pages_manage_instant_articles' | 'pages_manage_engagement' | 'pages_manage_metadata' |
  'pages_manage_posts' | 'pages_messaging' | 'pages_read_engagement' | 'pages_read_user_content' |
  'pages_show_list' | 'pages_user_gender' | 'pages_user_locale' | 'pages_user_timezone' |
  'private_computation_access' | 'public_profile' | 'publish_to_groups' | 'publish_video' |
  'read_insights' | 'user_age_range' | 'user_birthday' | 'user_friends' | 'user_gender' |
  'user_hometown' | 'user_likes' | 'user_link' | 'user_location' | 'user_messenger_contact' |
  'user_photos' | 'user_posts' | 'user_videos' | 'whatsapp_business_management' |
  'whatsapp_business_messaging'

export type Fields = 'id' | 'first_name' | 'last_name' | 'middle_name' | 'name' | 'name_format' |
  'picture' | 'short_name' | 'about' | 'age_range' | 'birthday' | 'education' | 'email' |
  'favorite_athletes' | 'favorite_teams' | 'gender' | 'hometown' | 'id_for_avatars' |
  'inspirational_people' | 'install_type' | 'installed' | 'is_guest_user' | 'languages' |
  'link' | 'location' | 'meeting_for' | 'middle_name' | 'payment_pricepoints' | 'political' |
  'profile_pic' | 'quotes' | 'relationship_status' | 'shared_login_upgrade_required_by' | 
  'significant_other' | 'sports' | 'supports_donate_button_in_live_video' | 'token_for_business'|
  'website' | ''

export type FacebookErrorResponse = {
  error?: {
    message: string
    type: string
    code: number
    fbtrace_id: string
  }
}

export type FacebookTokenResponse = {
  access_token: string
  token_type: string
  expires_in: number
} & FacebookErrorResponse

export type FacebookMeResponse = {
  name: string
  id: string
} & FacebookErrorResponse

export type FacebookUser = {
  id: string
  name: string
  email: string
  picture: {
    data: {
      height: number
      is_silhouette: boolean
      url: string
      width: number
    }
  }
  first_name: string
  last_name: string
  short_name: string
} & FacebookErrorResponse