import type { DefaultBodyType, StrictResponse } from 'msw'
import { HttpResponse, http } from 'msw'

import type {
  FacebookErrorResponse,
  FacebookTokenResponse,
  FacebookUser,
} from '../src/providers/facebook'
import type { GitHubErrorResponse, GitHubTokenResponse } from '../src/providers/github'
import type {
  GoogleErrorResponse,
  GoogleTokenResponse,
  GoogleUser,
} from '../src/providers/google/types'
import type { LinkedInErrorResponse, LinkedInTokenResponse } from '../src/providers/linkedin'

export const handlers = [
  // Google
  http.post(
    'https://oauth2.googleapis.com/token',
    async ({
      request,
    }): Promise<StrictResponse<Partial<GoogleTokenResponse> | GoogleErrorResponse>> => {
      const body = (await request.json()) as Promise<DefaultBodyType> & { code: string }
      if (body.code === dummyCode) {
        return HttpResponse.json(dummyToken)
      }
      return HttpResponse.json(googleCodeError)
    }
  ),
  http.get(
    'https://www.googleapis.com/oauth2/v2/userinfo',
    async ({ request }): Promise<StrictResponse<Partial<GoogleUser> | GoogleErrorResponse>> => {
      const authorization = request.headers.get('authorization')
      if (authorization === `Bearer ${dummyToken.access_token}`) {
        return HttpResponse.json(googleUser)
      }
      return HttpResponse.json(googleTokenError)
    }
  ),
  http.get('https://www.googleapis.com/oauth2/v1/tokeninfo', () =>
    HttpResponse.json(googleTokenInfo)
  ),
  // Facebook
  http.get(
    'https://graph.facebook.com/v18.0/oauth/access_token',
    async ({
      request,
    }): Promise<StrictResponse<Partial<FacebookTokenResponse> | FacebookErrorResponse>> => {
      const code = new URLSearchParams(request.url).get('code')
      if (dummyCode === code) {
        return HttpResponse.json(dummyToken)
      }
      return HttpResponse.json(facebookCodeError)
    }
  ),
  http.get('https://graph.facebook.com/v18.0/me', () => HttpResponse.json(facebookBasicInfo)),
  http.get(
    'https://graph.facebook.com/1abc345-75uyut',
    async ({ request }): Promise<StrictResponse<Partial<FacebookUser> | FacebookErrorResponse>> => {
      const token = new URLSearchParams(request.url).get('access_token')
      if (token === dummyToken.access_token) {
        return HttpResponse.json(facebookUser)
      }
      return HttpResponse.json(facebookTokenError)
    }
  ),
  // Github
  http.post(
    'https://github.com/login/oauth/access_token',
    async ({
      request,
    }): Promise<StrictResponse<Partial<GitHubTokenResponse | GitHubErrorResponse>>> => {
      const body = (await request.json()) as Promise<DefaultBodyType> & { code: string }
      if (body.code === dummyCode) {
        return HttpResponse.json(githubToken)
      }
      return HttpResponse.json(githubCodeError)
    }
  ),
  http.get('https://api.github.com/user', () => HttpResponse.json(githubUser)),
  // LinkedIn
  http.post(
    'https://www.linkedin.com/oauth/v2/accessToken',
    async ({
      request,
    }): Promise<StrictResponse<Partial<LinkedInTokenResponse> | LinkedInErrorResponse>> => {
      const code = new URLSearchParams(request.url).get('code')
      if (code === dummyCode) {
        return HttpResponse.json(linkedInToken)
      }
      return HttpResponse.json(linkedInCodeError)
    }
  ),
  http.get('https://api.linkedin.com/v2/userinfo', () => HttpResponse.json(linkedInUser)),
]

export const dummyCode = '4/0AfJohXl9tS46EmTA6u9x3pJQiyCNyahx4DLJaeJelzJ0E5KkT4qJmCtjq9n3FxBvO40ofg'
export const dummyToken = {
  access_token: '15d42a4d-1948-4de4-ba78-b8a893feaf45',
  expires_in: 60000,
  scope: 'openid email profile',
}

export const googleUser = {
  id: '1abc345-75uyut',
  email: 'example@email.com',
  verified_email: true,
  name: 'Carlos Aldazosa',
  given_name: 'Carlos',
  family_name: 'Aldazosa',
  picture: 'https://www.severnedgevets.co.uk/sites/default/files/guides/kitten.png',
  locale: 'es-419',
}
export const googleCodeError = {
  error: {
    code: 401,
    message: 'Invalid code.',
    status: '401',
    error: 'code_invalid',
  },
  error_description: 'Invalid code.',
}
export const googleTokenError = {
  error: {
    code: 401,
    message: 'Invalid token.',
    status: '401',
    error: 'token_invalid',
  },
  error_description: 'Invalid token.',
}
const googleTokenInfo = {
  issued_to: 'hyr97.457_e5gh4',
  audience: 'hyr97.457_e5gh4google.com',
  user_id: 'dummy-id',
  scope: 'openid email profile',
  expires_in: 60000,
  email: 'example@email.com',
  verified_email: true,
  access_type: 'user',
}

export const facebookUser = {
  id: '1abc345-75uyut',
  name: 'Carlos Aldazosa',
  email: 'example@email.com',
  picture: {
    data: {
      height: 50,
      width: 50,
      is_silhouette: true,
      url: 'https://www.severnedgevets.co.uk/sites/default/files/guides/kitten.png',
    },
  },
  first_name: 'Carlos',
  last_name: 'Aldazosa',
  short_name: 'Carlos',
}
export const facebookCodeError = {
  error: {
    message: 'Invalid Code.',
    type: 'Invalid',
    code: 401,
    fbtrace_id: 'jujublabla',
  },
}
export const facebookTokenError = {
  error: {
    message: 'Invalid Token.',
    type: 'Invalid',
    code: 401,
    fbtrace_id: 'jujublabla',
  },
}
const facebookBasicInfo = {
  id: '1abc345-75uyut',
  name: 'Carlos Aldazosa',
}

export const githubToken = {
  access_token: '15d42a4d-1948-4de4-ba78-b8a893feaf45',
  expires_in: 60000,
  scope: 'public_repo,user',
  refresh_token: 't4589fh-9gj3g93-34f5t64n',
  refresh_token_expires_in: 6000000,
  token_type: 'bearer',
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
    private_repos: 10000,
  },
}
export const githubCodeError = {
  error_description: 'Invalid Code.',
}

export const linkedInToken = {
  access_token: '15d42a4d-1948-4de4-ba78-b8a893feaf45',
  expires_in: 60000,
  scope: 'email,openid,profile',
  refresh_token: 't4589fh-9gj3g93-34f5t64n',
  refresh_token_expires_in: 6000000,
  token_type: 'bearer',
}
export const linkedInCodeError = {
  error_description: 'The Code you send is invalid.',
  error: 'The Code you send is invalid.',
  message: 'The Code you send is invalid.',
}
export const linkedInUser = {
  sub: '452FET361006',
  email_verified: true,
  name: 'Carlos Aldazosa',
  locale: {
    country: 'US',
    language: 'en',
  },
  given_name: 'Carlos',
  family_name: 'Aldazosa',
  email: 'example@email.com',
  picture: 'https://www.severnedgevets.co.uk/sites/default/files/guides/kitten.png',
}
