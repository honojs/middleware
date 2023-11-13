import type { DefaultBodyType, StrictResponse} from 'msw'
import { HttpResponse, http } from 'msw'
import type { GithubTokenResponse } from '../src'

export const handlers = [
  http.post('https://github.com/login/oauth/access_token', async ({ request }): Promise<StrictResponse<Partial<GithubTokenResponse>>> => {
    const body = await request.json() as Promise<DefaultBodyType> & { code: string }
    if (body.code === dummyCode) {
      return HttpResponse.json(githubToken)
    }
    return HttpResponse.json(githubCodeError)
  }),
  http.get('https://api.github.com/user', () => HttpResponse.json(githubUser)),
]

export const dummyCode = '4/0AfJohXl9tS46EmTA6u9x3pJQiyCNyahx4DLJaeJelzJ0E5KkT4qJmCtjq9n3FxBvO40ofg'
export const githubToken = {
  access_token: '15d42a4d-1948-4de4-ba78-b8a893feaf45',
  expires_in: 60000,
  scope: 'public_repo,user',
  refresh_token: 't4589fh-9gj3g93-34f5t64n',
  refresh_token_expires_in: 6000000,
  token_type: 'bearer'
}
export const githubUser = {
  login: 'monoald',
  id: 9876543210,
  node_id: 'HFGJ$FEF598',
  avatar_url: 'https://avatars.githubusercontent.com/u/userid',
  gravatar_id: '',
  url: 'https://api.github.com/users',
  html_url: 'https://github.com/monoald',
  followers_url: 'https://api.github.com/users/user/followers',
  following_url: 'https://api.github.com/users/user/following{/other_user}',
  gists_url: 'https://api.github.com/users/user/gists{/gist_id}',
  starred_url: 'https://api.github.com/users/user/starred{/owner}{/repo}',
  subscriptions_url: 'https://api.github.com/users/user/subscriptions',
  organizations_url: 'https://api.github.com/users/user/orgs',
  repos_url: 'https://api.github.com/users/user/repos',
  events_url: 'https://api.github.com/users/user/events{/privacy}',
  received_events_url: 'https://api.github.com/users/user/received_events',
  type: 'User',
  site_admin: false,
  name: 'Carlos Aldazosa',
  company: '@rvesoftware',
  blog: 'https://monoald.github.io/',
  location: 'Knowhere',
  email: null,
  hireable: null,
  bio: 'BIO description',
  twitter_username: 'monoald',
  public_repos: 0,
  public_gists: 0,
  followers: 0,
  following: 0,
  created_at: '2023-11-07T13:11:55Z',
  updated_at: '2023-11-07T13:11:56Z',
  private_gists: 0,
  total_private_repos: 0,
  owned_private_repos: 0,
  disk_usage: 100000,
  collaborators: 0,
  two_factor_authentication: false,
  plan: {
    name: 'free',
    space: 100000000,
    collaborators: 0,
    private_repos: 10000
  }
}
export const githubCodeError = {
  error: 'Invalid Code.'
}