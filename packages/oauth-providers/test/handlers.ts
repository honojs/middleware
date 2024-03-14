import type { DefaultBodyType, StrictResponse } from 'msw'
import { HttpResponse, http } from 'msw'

import type { DiscordErrorResponse, DiscordTokenResponse } from '../src/providers/discord'
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
import type { XErrorResponse, XRevokeResponse, XTokenResponse } from '../src/providers/x'

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
  http.get('https://api.github.com/user/emails', () => HttpResponse.json(githubEmails)),
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
  // X
  http.post(
    'https://api.twitter.com/2/oauth2/token',
    async ({ request }): Promise<StrictResponse<Partial<XTokenResponse> | XErrorResponse>> => {
      const code = new URLSearchParams(request.url.split('?')[1]).get('code')
      const grant_type = new URLSearchParams(request.url.split('?')[1]).get('grant_type')
      if (grant_type === 'refresh_token') {
        const refresh_token = new URLSearchParams(request.url.split('?')[1]).get('refresh_token')
        if (refresh_token === 'wrong-refresh-token') {
          return HttpResponse.json(xRefreshTokenError)
        }
        return HttpResponse.json(xRefreshToken)
      }
      if (code === dummyCode) {
        return HttpResponse.json(xToken)
      }
      return HttpResponse.json(xCodeError)
    }
  ),
  http.get('https://api.twitter.com/2/users/me', () => HttpResponse.json(xUser)),
  http.post(
    'https://api.twitter.com/2/oauth2/revoke',
    async ({ request }): Promise<StrictResponse<XRevokeResponse | XErrorResponse>> => {
      const token = new URLSearchParams(request.url.split('?')[1]).get('token')
      if (token === 'wrong-token') {
        return HttpResponse.json(xRevokeTokenError)
      }

      return HttpResponse.json({ revoked: true })
    }
  ),
  // Discord
  http.post(
    'https://discord.com/api/oauth2/token',
    async ({
      request,
    }): Promise<StrictResponse<Partial<DiscordTokenResponse> | DiscordErrorResponse>> => {
      const params = new URLSearchParams(await request.text())
      const code = params.get('code')
      const grant_type = params.get('grant_type')
      if (grant_type === 'refresh_token') {
        const refresh_token = params.get('refresh_token')
        if (refresh_token === 'wrong-refresh-token') {
          return HttpResponse.json(discordRefreshTokenError)
        }
        return HttpResponse.json(discordRefreshToken)
      }
      if (code === dummyCode) {
        return HttpResponse.json(discordToken)
      }
      return HttpResponse.json(discordCodeError)
    }
  ),
  http.get('https://discord.com/api/oauth2/@me', () => HttpResponse.json(discordUser)),
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
  email: 'test@email.com',
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
export const githubEmails = [
  {
    email: 'test@email.com',
    primary: true,
    verified: true,
    visibility: 'public',
  },
  {
    email: '671450+test@users.noreply.github.com',
    primary: false,
    verified: true,
    visibility: null,
  },
]
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

export const xToken = {
  token_type: 'bearer',
  expires_in: 7200,
  access_token:
    'RkNwZzE4X0EtRmNkWTktN1hoYmdWSFQ4RjBPTzhvNGZod01lZmIxSjY0Xy1pOjE3MDEyOTYyMTY1NjM6MToxOmF0OjE',
  scope: 'tweet.read users.read follows.read follows.write offline.access',
  refresh_token:
    'R0d4OW1raGIwOVZGekZJWjZBbUhqOUZkb0k2UzJ1MkNEVnA4M1J0VmFTOWI3OjE3MDEyOTYyMTY1NjM6MToxOnJ0OjE',
}
export const xRefreshToken = {
  token_type: 'bearer',
  expires_in: 7200,
  access_token: 'isdFho34isdX6hd3vODOFFNubUEBosihjcXifjdC34dsdsd349Djs9cgSA2',
  scope: 'tweet.read users.read follows.read follows.write offline.access',
  refresh_token: 'VZGekZJWjZBbUhqOUZkb0k2UzJ1MkNEVnTYyMTY1NjM6MToxOnJ0Ojsdsd562x',
}
export const xCodeError = {
  error: 'The Code you send is invalid.',
  error_description: 'The Code you send is invalid.',
}
export const xRefreshTokenError = {
  error: 'Invalid.',
  error_description: 'Invalid Refresh Token.',
}
export const xRevokeTokenError = {
  error: 'Something went wrong.',
  error_description: 'Unable to invalid token.',
}
export const xUser = {
  data: {
    entities: {
      url: {
        urls: [
          {
            start: 0,
            end: 23,
            url: 'https://t.co/J2mwejW4cB',
            expanded_url: 'https://monoald.github.io/',
            display_url: 'monoald.github.io',
          },
        ],
      },
    },
    url: 'https://t.co/J2mwejW4cB',
    description: '💻 Front-end Developer',
    username: 'monoald',
    protected: true,
    verified: true,
    public_metrics: {
      followers_count: 1,
      following_count: 2,
      tweet_count: 3,
      listed_count: 4,
      like_count: 5,
    },
    location: 'La Paz - Bolivia',
    most_recent_tweet_id: '123456987465',
    verified_type: 'none',
    id: '123456',
    profile_image_url: 'https://www.severnedgevets.co.uk/sites/default/files/guides/kitten.png',
    created_at: '1018-12-01T13:53:50.000Z',
    name: 'Carlos Aldazosa',
  },
}

export const discordToken = {
  token_type: 'bearer',
  expires_in: 7200,
  access_token:
    'RkNwZzE4X0EtRmNkWTktN1hoYmdWSFQ4RjBPTzhvNGZod01lZmIxSjY0Xy1pOjE3MDEyOTYyMTY1NjM6MToxOmF0OjE',
  scope: 'identify email',
  refresh_token:
    'R0d4OW1raGIwOVZGekZJWjZBbUhqOUZkb0k2UzJ1MkNEVnA4M1J0VmFTOWI3OjE3MDEyOTYyMTY1NjM6MToxOnJ0OjE',
}
export const discordCodeError = {
  error: 'The Code you send is invalid.',
}
export const discordUser = {
  user: {
    id: '5869901058880055',
    username: 'monoald',
    avatar: 'e578fa5518c158ff',
    discriminator: '0',
    public_flags: 0,
    premium_type: 0,
    flags: 0,
    banner: null,
    accent_color: null,
    global_name: 'monoald',
    avatar_decoration_data: null,
    banner_color: null,
  },
}
export const discordRefreshToken = {
  token_type: 'bearer',
  expires_in: 7200,
  access_token: 'isdFho34isdX6hd3vODOFFNubUEBosihjcXifjdC34dsdsd349Djs9cgSA2',
  scope: 'tweet.read users.read follows.read follows.write offline.access',
  refresh_token: 'VZGekZJWjZBbUhqOUZkb0k2UzJ1MkNEVnTYyMTY1NjM6MToxOnJ0Ojsdsd562x',
}
export const discordRefreshTokenError = {
  error: 'Invalid Refresh Token.',
}
