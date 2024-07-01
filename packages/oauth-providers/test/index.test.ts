import { Hono } from 'hono'
import { setupServer } from 'msw/node'
import type { DiscordUser } from '../src/providers/discord'
import {
  discordAuth,
  refreshToken as discordRefresh,
  revokeToken as discordRevoke,
} from '../src/providers/discord'
import { facebookAuth } from '../src/providers/facebook'
import type { FacebookUser } from '../src/providers/facebook'
import { githubAuth } from '../src/providers/github'
import type { GitHubUser } from '../src/providers/github'
import { googleAuth } from '../src/providers/google'
import type { GoogleUser } from '../src/providers/google'
import { linkedinAuth } from '../src/providers/linkedin'
import type { LinkedInUser } from '../src/providers/linkedin'
import type { XUser } from '../src/providers/x'
import { refreshToken, revokeToken, xAuth } from '../src/providers/x'
import type { Token } from '../src/types'
import {
  discordCodeError,
  discordRefreshToken,
  discordRefreshTokenError,
  discordToken,
  discordUser,
  dummyCode,
  dummyToken,
  facebookCodeError,
  facebookUser,
  githubCodeError,
  githubToken,
  githubUser,
  googleCodeError,
  googleUser,
  handlers,
  linkedInCodeError,
  linkedInToken,
  linkedInUser,
  xCodeError,
  xRefreshToken,
  xRefreshTokenError,
  xRevokeTokenError,
  xToken,
  xUser,
} from './handlers'

const server = setupServer(...handlers)
server.listen()

const client_id = '1jsdsldjkssd-4343dsasdsd34ghhn4-dummyid'
const client_secret = 'SDJS943hS_jj45dummysecret'

describe('OAuth Middleware', () => {
  const app = new Hono()

  // Google
  app.use(
    '/google',
    googleAuth({
      client_id,
      client_secret,
      scope: ['openid', 'email', 'profile'],
    })
  )
  app.get('/google', (c) => {
    const user = c.get('user-google')
    const token = c.get('token')
    const grantedScopes = c.get('granted-scopes')

    return c.json({
      user,
      token,
      grantedScopes,
    })
  })

  // Facebook
  app.use(
    '/facebook',
    facebookAuth({
      client_id,
      client_secret,
      scope: ['email', 'public_profile'],
      fields: [
        'email',
        'id',
        'first_name',
        'last_name',
        'middle_name',
        'name',
        'picture',
        'short_name',
      ],
    })
  )
  app.get('/facebook', (c) => {
    const user = c.get('user-facebook')
    const token = c.get('token')
    const grantedScopes = c.get('granted-scopes')

    return c.json({
      user,
      token,
      grantedScopes,
    })
  })

  // Github
  app.use(
    '/github/app',
    githubAuth({
      client_id,
      client_secret,
    })
  )
  app.get('/github/app', (c) => {
    const token = c.get('token')
    const refreshToken = c.get('refresh-token')
    const user = c.get('user-github')
    const grantedScopes = c.get('granted-scopes')

    return c.json({
      token,
      refreshToken,
      user,
      grantedScopes,
    })
  })
  app.use(
    '/github/oauth-app',
    githubAuth({
      client_id,
      client_secret,
      scope: ['public_repo', 'read:user', 'user', 'user:email', 'user:follow'],
      oauthApp: true,
    })
  )
  app.get('/github/oauth-app', (c) => {
    const token = c.get('token')
    const user = c.get('user-github')
    const grantedScopes = c.get('granted-scopes')

    return c.json({
      user,
      token,
      grantedScopes,
    })
  })

  // LinkedIn
  app.use(
    '/linkedin',
    linkedinAuth({
      client_id,
      client_secret,
      scope: ['email', 'openid', 'profile'],
    })
  )
  app.get('/linkedin', (c) => {
    const token = c.get('token')
    const refreshToken = c.get('refresh-token')
    const user = c.get('user-linkedin')
    const grantedScopes = c.get('granted-scopes')

    return c.json({
      token,
      refreshToken,
      grantedScopes,
      user,
    })
  })

  // X
  app.use(
    '/x',
    xAuth({
      client_id,
      client_secret,
      scope: ['tweet.read', 'users.read', 'follows.read', 'follows.write', 'offline.access'],
      fields: [
        'created_at',
        'description',
        'entities',
        'location',
        'most_recent_tweet_id',
        'pinned_tweet_id',
        'profile_image_url',
        'protected',
        'public_metrics',
        'url',
        'verified',
        'verified_type',
        'withheld',
      ],
    })
  )
  app.get('/x', (c) => {
    const token = c.get('token')
    const refreshToken = c.get('refresh-token')
    const user = c.get('user-x')
    const grantedScopes = c.get('granted-scopes')

    return c.json({
      token,
      refreshToken,
      grantedScopes,
      user,
    })
  })
  app.get('x/refresh', async (c) => {
    const response = await refreshToken(
      client_id,
      client_secret,
      'MzJvY0QyNmNzWUtBU3BUelpOU1NLdXFOd05qdGROZFhtR3o3QkpPNHZpQ2xrOjE3MDEyOTU0ODkxMzM6MTowOnJ0OjE'
    )
    return c.json(response)
  })
  app.get('x/refresh/error', async (c) => {
    const response = await refreshToken(client_id, client_secret, 'wrong-refresh-token')
    return c.json(response)
  })
  app.get('/x/revoke', async (c) => {
    const response = await revokeToken(
      client_id,
      client_secret,
      'RkNwZzE4X0EtRmNkWTktN1hoYmdWSFQ4RjBPTzhvNGZod01lZmIxSjY0Xy1pOjE3MDEyOTYyMTY1NjM6MToxOmF0OjE'
    )
    return c.json(response)
  })
  app.get('x/revoke/error', async (c) => {
    const response = await revokeToken(client_id, client_secret, 'wrong-token')
    return c.json(response)
  })

  // Discord
  app.use(
    '/discord',
    discordAuth({
      client_id,
      client_secret,
      scope: ['identify', 'email'],
    })
  )
  app.get('/discord', (c) => {
    const token = c.get('token')
    const refreshToken = c.get('refresh-token')
    const user = c.get('user-discord')
    const grantedScopes = c.get('granted-scopes')

    return c.json({
      token,
      refreshToken,
      grantedScopes,
      user,
    })
  })
  app.get('/discord/refresh', async (c) => {
    const response = await discordRefresh(
      client_id,
      client_secret,
      'MzJvY0QyNmNzWUtBU3BUelpOU1NLdXFOd05qdGROZFhtR3o3QkpPNHZpQ2xrOjE3MDEyOTU0ODkxMzM6MTowOnJ0OjE'
    )
    return c.json(response)
  })
  app.get('/discord/refresh/error', async (c) => {
    const response = await discordRefresh(client_id, client_secret, 'wrong-refresh-token')
    return c.json(response)
  })
  app.get('/discord/revoke', async (c) => {
    const response = await discordRevoke(
      client_id,
      client_secret,
      'RkNwZzE4X0EtRmNkWTktN1hoYmdWSFQ4RjBPTzhvNGZod01lZmIxSjY0Xy1pOjE3MDEyOTYyMTY1NjM6MToxOmF0OjE'
    )
    return c.json(response)
  })
  app.get('/discord/revoke/error', async (c) => {
    const response = await discordRevoke(client_id, client_secret, 'wrong-token')
    return c.json(response)
  })

  beforeAll(() => {
    server.listen()
  })
  afterEach(() => {
    server.resetHandlers()
  })
  afterAll(() => {
    server.close()
  })

  describe('googleAuth middleware', () => {
    it('Should redirect', async () => {
      const res = await app.request('/google')

      expect(res).not.toBeNull()
      expect(res.status).toBe(302)
    })

    it('Prevent CSRF attack', async () => {
      const res = await app.request(`/google?code=${dummyCode}&state=malware-state`)

      expect(res).not.toBeNull()
      expect(res.status).toBe(401)
    })

    it('Should throw error for invalide code', async () => {
      const res = await app.request('/google?code=9348ffdsd-sdsdbad-code')

      expect(res).not.toBeNull()
      expect(res.status).toBe(400)
      expect(await res.text()).toBe(googleCodeError.error.message)
    })

    it('Should work with received code', async () => {
      const res = await app.request(`/google?code=${dummyCode}`)
      const response = (await res.json()) as {
        token: Token
        user: GoogleUser
        grantedScopes: string[]
      }

      expect(res).not.toBeNull()
      expect(res.status).toBe(200)
      expect(response.user).toEqual(googleUser)
      expect(response.grantedScopes).toEqual(dummyToken.scope.split(' '))
      expect(response.token).toEqual({
        token: dummyToken.access_token,
        expires_in: dummyToken.expires_in,
      })
    })
  })

  describe('facebookAuth middleware', () => {
    it('Should redirect', async () => {
      const res = await app.request('/facebook')

      expect(res).not.toBeNull()
      expect(res.status).toBe(302)
    })

    it('Prevent CSRF attack', async () => {
      const res = await app.request(`/facebook?code=${dummyCode}&state=malware-state`)
      expect(res).not.toBeNull()
      expect(res.status).toBe(401)
    })

    it('Should throw error for invalid code', async () => {
      const res = await app.request('/facebook?code=9348ffdsd-sdsdbad-code')

      expect(res).not.toBeNull()
      expect(res.status).toBe(400)
      expect(await res.text()).toBe(facebookCodeError.error.message)
    })

    it('Should work with received code', async () => {
      const res = await app.request(
        `/facebook?code=${dummyCode}&granted_scopes=email%2Cpublic_profile`
      )
      const response = (await res.json()) as {
        token: Token
        user: FacebookUser
        grantedScopes: string[]
      }

      expect(res).not.toBeNull()
      expect(res.status).toBe(200)
      expect(response.user).toEqual(facebookUser)
      expect(response.grantedScopes).toEqual(['email', 'public_profile'])
      expect(response.token).toEqual({
        token: dummyToken.access_token,
        expires_in: dummyToken.expires_in,
      })
    })
  })

  describe('githubAuth middleware', () => {
    describe('Github with Github App', () => {
      it('Should redirect', async () => {
        const res = await app.request('/github/app')

        expect(res).not.toBeNull()
        expect(res.status).toBe(302)
      })

      it('Should throw error for invalide code', async () => {
        const res = await app.request('/github/app?code=9348ffdsd-sdsdbad-code')

        expect(res).not.toBeNull()
        expect(res.status).toBe(400)
        expect(await res.text()).toBe(githubCodeError.error_description)
      })

      it('Should work with received code', async () => {
        const res = await app.request(`/github/app?code=${dummyCode}`)
        const response = (await res.json()) as {
          token: Token
          refreshToken: Token
          user: GitHubUser
          grantedScopes: string[]
        }

        expect(res).not.toBeNull()
        expect(res.status).toBe(200)
        expect(response.user).toEqual(githubUser)
        expect(response.grantedScopes).toEqual(['public_repo', 'user'])
        expect(response.token).toEqual({
          token: githubToken.access_token,
          expires_in: githubToken.expires_in,
        })
        expect(response.refreshToken).toEqual({
          token: githubToken.refresh_token,
          expires_in: githubToken.refresh_token_expires_in,
        })
      })
    })

    describe('Github with OAuth App', () => {
      it('Should redirect', async () => {
        const res = await app.request('/github/oauth-app')

        expect(res).not.toBeNull()
        expect(res.status).toBe(302)
      })

      it('Should throw error for invalide code', async () => {
        const res = await app.request('/github/oauth-app?code=9348ffdsd-sdsdbad-code')

        expect(res).not.toBeNull()
        expect(res.status).toBe(400)
        expect(await res.text()).toBe(githubCodeError.error_description)
      })

      it('Should work with received code', async () => {
        const res = await app.request(`/github/oauth-app?code=${dummyCode}`)
        const response = (await res.json()) as {
          token: Token
          user: GitHubUser
          grantedScopes: string[]
        }

        expect(res).not.toBeNull()
        expect(res.status).toBe(200)
        expect(response.user).toEqual(githubUser)
        expect(response.grantedScopes).toEqual(['public_repo', 'user'])
        expect(response.token).toEqual({
          token: githubToken.access_token,
          expires_in: githubToken.expires_in,
        })
      })
    })
  })

  describe('linkedinAuth middleware', () => {
    it('Should redirect', async () => {
      const res = await app.request('/linkedin')

      expect(res).not.toBeNull()
      expect(res.status).toBe(302)
    })

    it('Should throw error for invalide code', async () => {
      const res = await app.request('/linkedin?code=9348ffdsd-sdsdbad-code')

      expect(res).not.toBeNull()
      expect(res.status).toBe(400)
      expect(await res.text()).toBe(linkedInCodeError.error)
    })

    it('Should work with received code', async () => {
      const res = await app.request(`/linkedin?code=${dummyCode}`)
      const response = (await res.json()) as {
        token: Token
        refreshToken: Token
        user: LinkedInUser
        grantedScopes: string[]
      }

      expect(res).not.toBeNull()
      expect(res.status).toBe(200)
      expect(response.user).toEqual(linkedInUser)
      expect(response.grantedScopes).toEqual(['email', 'openid', 'profile'])
      expect(response.token).toEqual({
        token: linkedInToken.access_token,
        expires_in: linkedInToken.expires_in,
      })
      expect(response.refreshToken).toEqual({
        token: linkedInToken.refresh_token,
        expires_in: linkedInToken.refresh_token_expires_in,
      })
    })
  })

  describe('xAuth middleware', () => {
    describe('middleware', () => {
      it('Should redirect', async () => {
        const res = await app.request('/x')

        expect(res).not.toBeNull()
        expect(res.status).toBe(302)
      })

      it('Prevent CSRF attack', async () => {
        const res = await app.request(`/x?code=${dummyCode}&state=malware-state`)
        expect(res).not.toBeNull()
        expect(res.status).toBe(401)
      })

      it('Should throw error for invalid code', async () => {
        const res = await app.request('/x?code=9348ffdsd-sdsdbad-code')

        expect(res).not.toBeNull()
        expect(res.status).toBe(400)
        expect(await res.text()).toBe(xCodeError.error_description)
      })

      it('Should work with received code', async () => {
        const res = await app.request(`/x?code=${dummyCode}`)
        const response = (await res.json()) as {
          token: Token
          refreshToken: Token
          user: XUser
          grantedScopes: string[]
        }

        expect(res).not.toBeNull()
        expect(res.status).toBe(200)
        expect(response.user).toEqual(xUser.data)
        expect(response.grantedScopes).toEqual([
          'tweet.read',
          'users.read',
          'follows.read',
          'follows.write',
          'offline.access',
        ])
        expect(response.token).toEqual({
          token: xToken.access_token,
          expires_in: xToken.expires_in,
        })
        expect(response.refreshToken).toEqual({
          token: xToken.refresh_token,
          expires_in: 0,
        })
      })
    })

    describe('Refresh Token', () => {
      it('Should refresh token', async () => {
        const res = await app.request('/x/refresh')

        expect(res).not.toBeNull()
        expect(await res.json()).toEqual(xRefreshToken)
      })

      it('Should return error for refresh', async () => {
        const res = await app.request('/x/refresh/error')

        expect(res).not.toBeNull()
        expect(res.status).toBe(400)
        expect(await res.text()).toBe(xRefreshTokenError.error_description)
      })
    })

    describe('Revoke Token', () => {
      it('Should revoke token', async () => {
        const res = await app.request('/x/revoke')

        expect(res).not.toBeNull()
        expect(await res.json()).toEqual(true)
      })

      it('Should return error for revoke', async () => {
        const res = await app.request('/x/revoke/error')

        expect(res).not.toBeNull()
        expect(res.status).toBe(400)
        expect(await res.text()).toBe(xRevokeTokenError.error_description)
      })
    })
  })

  describe('discordAuth middleware', () => {
    describe('middleware', () => {
      it('Should redirect', async () => {
        const res = await app.request('/discord')

        expect(res).not.toBeNull()
        expect(res.status).toBe(302)
      })

      it('Prevent CSRF attack', async () => {
        const res = await app.request(`/discord?code=${dummyCode}&state=malware-state`)
        expect(res).not.toBeNull()
        expect(res.status).toBe(401)
      })

      it('Should throw error for invalid code', async () => {
        const res = await app.request('/discord?code=9348ffdsd-sdsdbad-code')

        expect(res).not.toBeNull()
        expect(res.status).toBe(400)
        expect(await res.text()).toBe(discordCodeError.error)
      })

      it('Should work with received code', async () => {
        const res = await app.request(`/discord?code=${dummyCode}`)
        const response = (await res.json()) as {
          token: Token
          refreshToken: Token
          user: DiscordUser
          grantedScopes: string[]
        }

        expect(res).not.toBeNull()
        expect(res.status).toBe(200)
        expect(response.user).toEqual(discordUser.user)
        expect(response.grantedScopes).toEqual(['identify', 'email'])
        expect(response.token).toEqual({
          token: discordToken.access_token,
          expires_in: discordToken.expires_in,
        })
        expect(response.refreshToken).toEqual({
          token: discordToken.refresh_token,
          expires_in: 0,
        })
      })
    })

    describe('Refresh Token', () => {
      it('Should refresh token', async () => {
        const res = await app.request('/discord/refresh')

        expect(res).not.toBeNull()
        expect(await res.json()).toEqual(discordRefreshToken)
      })

      it('Should return error for refresh', async () => {
        const res = await app.request('/discord/refresh/error')

        expect(res).not.toBeNull()
        expect(res.status).toBe(400)
        expect(await res.text()).toBe(discordRefreshTokenError.error)
      })
    })
  })
})
