import { Hono } from 'hono'
import { setupServer } from 'msw/node'
import { facebookAuth } from '../src/providers/facebook'
import type { FacebookUser } from '../src/providers/facebook'
import { githubAuth } from '../src/providers/github'
import type { GitHubUser } from '../src/providers/github'
import { googleAuth } from '../src/providers/google'
import type { GoogleUser } from '../src/providers/google'
import { linkedinAuth } from '../src/providers/linkedin'
import type { LinkedInUser } from '../src/providers/linkedin'
import type { Token, OAuthVariables } from '../src/types'
import {
  dummyToken,
  googleUser,
  handlers,
  facebookUser,
  githubUser,
  dummyCode,
  googleCodeError,
  facebookCodeError,
  githubToken,
  githubCodeError,
  linkedInCodeError,
  linkedInUser,
  linkedInToken,
} from './handlers'

const server = setupServer(...handlers)
server.listen()

const client_id = '1jsdsldjkssd-4343dsasdsd34ghhn4-dummyid'
const client_secret = 'SDJS943hS_jj45dummysecret'

describe('OAuth Middleware', () => {
  const app = new Hono<{ Variables: OAuthVariables }>()

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

  app.use(
    'linkedin',
    linkedinAuth({
      client_id,
      client_secret,
      scope: ['email', 'openid', 'profile'],
    })
  )
  app.get('linkedin', (c) => {
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
})
