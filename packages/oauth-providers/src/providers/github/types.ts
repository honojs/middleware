export type GitHubScope =
  | 'repo'
  | 'repo:status'
  | 'repo_deployment'
  | 'public_repo'
  | 'repo:invite'
  | 'security_events'
  | 'admin:repo_hook'
  | 'write:repo_hook'
  | 'read:repo_hook'
  | 'admin:org'
  | 'write:org'
  | 'read:org'
  | 'admin:public_key'
  | 'write:public_key'
  | 'read:public_key'
  | 'admin:org_hook'
  | 'gist'
  | 'notifications'
  | 'user'
  | 'read:user'
  | 'user:email'
  | 'user:follow'
  | 'project'
  | 'read:project'
  | 'delete_repo'
  | 'write:packages'
  | 'read:packages'
  | 'delete:packages'
  | 'admin:gpg_key'
  | 'write:gpg_key'
  | 'read:gpg_key'
  | 'codespace'
  | 'workflow'

export type GitHubErrorResponse = {
  error: string
  error_description: string
  message: string
  documentation_url: string
}

export type GitHubTokenResponse = {
  access_token: string
  expires_in?: number
  refresh_token?: string
  refresh_token_expires_in?: number
  token_type: string
  scope: string
}

export type GitHubUser = {
  login: string
  id: number
  node_id: string
  avatar_url: string
  gravatar_id: string
  url: string
  html_url: string
  followers_url: string
  following_url: string
  gists_url: string
  starred_url: string
  subscriptions_url: string
  organizations_url: string
  repos_url: string
  events_url: string
  received_events_url: string
  type: string
  site_admin: boolean
  name: string
  company: string
  blog: string
  location: string
  email: string | null
  hireable: boolean | null
  bio: string
  twitter_username: string
  public_repos: number
  public_gists: number
  followers: number
  following: number
  created_at: string
  updated_at: string
  private_gists: number
  total_private_repos: number
  owned_private_repos: number
  disk_usage: number
  collaborators: number
  two_factor_authentication: boolean
  plan: {
    name: string
    space: number
    collaborators: number
    private_repos: number
  }
}

export type GitHubEmailResponse = {
  email: string
  primary: boolean
  vrified: boolean
  visibility: string
}
