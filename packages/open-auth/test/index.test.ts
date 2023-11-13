import { Hono } from 'hono'
import { setupServer } from 'msw/node'

import type { FacebookUser, GithubUser, GoogleUser, LinkedInUser, OpenAuthVariables, Token} from '../src'
import { facebookAuth, githubAuth, googleAuth, linkedInAuth } from '../src'
import { dummyToken, googleUser, handlers, facebookUser, githubUser, dummyCode, googleCodeError, googleTokenError, facebookCodeError, facebookTokenError, githubToken, githubCodeError, linkedInCodeError, linkedInUser, linkedInToken } from './handlers'

const server = setupServer(...handlers)
server.listen()

const client_id = '1jsdsldjkssd-4343dsasdsd34ghhn4-dummyid'
const client_secret = 'SDJS943hS_jj45dummysecret'

describe('Open Auth', () => {
  const app = new Hono<{ Variables: OpenAuthVariables }>()

  app.use('/google/code', googleAuth({
    client_id,
    client_secret,
    include_granted_scopes: true,
    response_type: 'code',
    scope: ['openid', 'email', 'profile'],
    state: 'secure-state'
  }))
  app.get('/google/code', (c) => {
    const user = c.get('user-google')
    const token = c.get('token')
    const grantedScopes = c.get('granted-scopes')

    return c.json({
      user,
      token,
      grantedScopes
    })
  })

  app.use('/google/token', googleAuth({
    client_id,
    client_secret,
    include_granted_scopes: true,
    response_type: 'token',
    scope: ['openid', 'email', 'profile'],
    state: 'secure-state'
  }))
  app.get('/google/token', (c) => {
    const user = c.get('user-google')
    const token = c.get('token')
    const grantedScopes = c.get('granted-scopes')

    return c.json({
      user,
      token,
      grantedScopes
    })
  })

  app.use('/facebook/code', facebookAuth({
    client_id,
    client_secret,
    response_type: ['code'],
    scope: ['email', 'public_profile'],
    fields: ['email', 'id', 'first_name', 'last_name', 'middle_name', 'name', 'picture', 'short_name'],
    include_granted_scopes: true,
    state: 'secure-state'
  }))
  app.get('/facebook/code', (c) => {
    const user = c.get('user-facebook')
    const token = c.get('token')
    const grantedScopes = c.get('granted-scopes')

    return c.json({
      user,
      token,
      grantedScopes
    })
  })

  app.use('/facebook/token', facebookAuth({
    client_id,
    client_secret,
    response_type: ['token'],
    scope: ['email', 'public_profile'],
    fields: ['email', 'id', 'first_name', 'last_name', 'middle_name', 'name', 'picture', 'short_name'],
    include_granted_scopes: true,
    state: 'secure-state'
  }))
  app.get('/facebook/token', (c) => {
    const user = c.get('user-facebook')
    const token = c.get('token')
    const grantedScopes = c.get('granted-scopes')

    return c.json({
      user,
      token,
      grantedScopes
    })
  })

  app.use('/github/app', githubAuth({
    client_id,
    client_secret
  }))
  app.get('/github/app', (c) => {
    const token = c.get('token')
    const refreshToken = c.get('refresh-token')
    const user = c.get('user-github')
    const grantedScopes = c.get('granted-scopes')

    return c.json({
      token,
      refreshToken,
      user,
      grantedScopes
    })
  })

  app.use('/github/oauth-app', githubAuth({
    client_id,
    client_secret,
    scope: ['public_repo', 'read:user', 'user', 'user:email', 'user:follow'],
    oauthApp: true
  }))
  app.get('/github/oauth-app', (c) => {
    const token = c.get('token')
    const user = c.get('user-github')
    const grantedScopes = c.get('granted-scopes')

    return c.json({
      user,
      token,
      grantedScopes
    })
  })

  app.use('linkedin', linkedInAuth({
    scope: ['email', 'openid', 'profile'],
    state: 'secure-state'
  }))
  app.get('linkedin', (c) => {
    const token = c.get('token')
    const refreshToken = c.get('refresh-token')
    const user = c.get('user-linkedin')
    const grantedScopes = c.get('granted-scopes')

    return c.json({
      token,
      refreshToken,
      grantedScopes,
      user
    })
  })

  beforeAll(() => { server.listen() })
  afterEach(() => { server.resetHandlers() })
  afterAll(() => { server.close() })

  describe('googleAuth middleware', () => {
    describe('Google with code response_type', () => {
      it('Should redirect', async () => {
        const res = await app.request('/google/code')

        expect(res).not.toBeNull()
        expect(res.status).toBe(302)
      })

      it('Prevent CSRF attack', async () => {
        const res = await app.request(`/google/code?code=${dummyCode}&state=malware-state`)

        expect(res).not.toBeNull()
        expect(res.status).toBe(401)
      })

      it('Should throw error for invalide code', async () => {
        const res = await app.request('/google/code?code=9348ffdsd-sdsdbad-code&state=secure-state')

        expect(res).not.toBeNull()
        expect(res.status).toBe(500)
        expect(await res.text()).toBe(googleCodeError.error.message)
      })

      it('Should work with received code', async () => {
        const res = await app.request(`/google/code?code=${dummyCode}&state=secure-state`)
        const response = await res.json() as { token: Token, user: GoogleUser, grantedScopes: string[] }

        expect(res).not.toBeNull()
        expect(res.status).toBe(200)
        expect(response.user).toEqual(googleUser)
        expect(response.grantedScopes).toEqual(dummyToken.scope.split(' '))
        expect(response.token).toEqual({
          token: dummyToken.access_token,
          expires_in: dummyToken.expires_in
        })
      })
    })

    describe('Google with token response_type', () => {
      it('Should redirect', async () => {
        const res = await app.request('/google/token')

        expect(res).not.toBeNull()
        expect(res.status).toBe(200)
      })

      it('Prevent CSRF attack', async () => {
        const res = await app.request(`/google/token?access_token=${dummyToken.access_token}&expires-in=${dummyToken.expires_in}&state=malware-state`)

        expect(res).not.toBeNull()
        expect(res.status).toBe(401)
      })

      it('Should throw error for invalid token', async () => {
        const res = await app.request(`/google/token?access_token=blabla-invalid-token&expires-in=${dummyToken.expires_in}&state=secure-state`)

        expect(res).not.toBeNull()
        expect(res.status).toBe(500)
        expect(await res.text()).toBe(googleTokenError.error.message)
      })

      it('Should work with received token', async () => {
        const res = await app.request(`/google/token?access_token=${dummyToken.access_token}&expires-in=${dummyToken.expires_in}&state=secure-state`)
        const response = await res.json() as { token: Token, user: GoogleUser, grantedScopes: string[] }

        expect(res).not.toBeNull()
        expect(res.status).toBe(200)
        expect(response.user).toEqual(googleUser)
        expect(response.grantedScopes).toEqual(dummyToken.scope.split(' '))
        expect(response.token).toEqual({
          token: dummyToken.access_token,
          expires_in: dummyToken.expires_in
        })
      })
    })
  })

  describe('facebookAuth middleware', () => {
    describe('Facebook with code response_type', () => {
      it('Should redirect', async () => {
        const res = await app.request('/facebook/code')

        expect(res).not.toBeNull()
        expect(res.status).toBe(302)
      })

      it('Prevent CSRF attack', async () => {
        const res = await app.request(`/facebook/code?code=${dummyCode}&state=malware-state`)
        expect(res).not.toBeNull()
        expect(res.status).toBe(401)
      })

      it('Should throw error for invalide code', async () => {
        const res = await app.request('/facebook/code?code=9348ffdsd-sdsdbad-code&state=secure-state')

        expect(res).not.toBeNull()
        expect(res.status).toBe(500)
        expect(await res.text()).toBe(facebookCodeError.error.message)
      })

      it('Should work with received code', async () => {
        const res = await app.request(`/facebook/code?code=${dummyCode}&state=secure-state&granted_scopes=email%2Cpublic_profile`)
        const response = await res.json() as { token: Token, user: FacebookUser, grantedScopes: string[] }

        expect(res).not.toBeNull()
        expect(res.status).toBe(200)
        expect(response.user).toEqual(facebookUser)
        expect(response.grantedScopes).toEqual(['email', 'public_profile'])
        expect(response.token).toEqual({
          token: dummyToken.access_token,
          expires_in: dummyToken.expires_in
        })
      })
    })

    describe('Facebook with token response_type', () => {
      it('Should redirect', async () => {
        const res = await app.request('/google/token')

        expect(res).not.toBeNull()
        expect(res.status).toBe(200)
      })

      it('Prevent CSRF attack', async () => {
        const res = await app.request(`/google/token?access_token=${dummyToken.access_token}&expires_in=${dummyToken.expires_in}&state=malware-state`)
        expect(res).not.toBeNull()
        expect(res.status).toBe(401)
      })

      it('Should throw error for invalide token', async () => {
        const res = await app.request('/facebook/token?access_token=9348ffdsd-sdsdbad-invalidtoken&state=secure-state')

        expect(res).not.toBeNull()
        expect(res.status).toBe(500)
        expect(await res.text()).toBe(facebookTokenError.error.message)
      })

      it('Should work with received token', async () => {
        const res = await app.request(`/facebook/token?access_token=${dummyToken.access_token}&expires_in=${dummyToken.expires_in}&state=secure-state&granted_scopes=openid,email,profile`)
        const response = await res.json() as { token: Token, user: GoogleUser, grantedScopes: string[] }

        expect(res).not.toBeNull()
        expect(res.status).toBe(200)
        expect(response.user).toEqual(facebookUser)
        expect(response.grantedScopes).toEqual(dummyToken.scope.split(' '))
        expect(response.token).toEqual({
          token: dummyToken.access_token,
          expires_in: dummyToken.expires_in
        })
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
        const res = await app.request('/github/app?code=9348ffdsd-sdsdbad-code&state=secure-state')

        expect(res).not.toBeNull()
        expect(res.status).toBe(500)
        expect(await res.text()).toBe(githubCodeError.error)
      })

      it('Should work with received code', async () => {
        const res = await app.request(`/github/app?code=${dummyCode}`)
        const response = await res.json() as { token: Token, refreshToken: Token, user: GithubUser, grantedScopes: string[] }

        expect(res).not.toBeNull()
        expect(res.status).toBe(200)
        expect(response.user).toEqual(githubUser)
        expect(response.grantedScopes).toEqual(['public_repo', 'user'])
        expect(response.token).toEqual({
          token: githubToken.access_token,
          expires_in: githubToken.expires_in
        })
        expect(response.refreshToken).toEqual({
          token: githubToken.refresh_token,
          expires_in: githubToken.refresh_token_expires_in
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
        const res = await app.request('/github/oauth-app?code=9348ffdsd-sdsdbad-code&state=secure-state')

        expect(res).not.toBeNull()
        expect(res.status).toBe(500)
        expect(await res.text()).toBe(githubCodeError.error)
      })

      it('Should work with received code', async () => {
        const res = await app.request(`/github/oauth-app?code=${dummyCode}`)
        const response = await res.json() as { token: Token, user: GithubUser, grantedScopes: string[] }

        expect(res).not.toBeNull()
        expect(res.status).toBe(200)
        expect(response.user).toEqual(githubUser)
        expect(response.grantedScopes).toEqual(['public_repo', 'user'])
        expect(response.token).toEqual({
          token: githubToken.access_token,
          expires_in: githubToken.expires_in
        })
      })
    })
  })

  describe('linkedInAuth middleware', () => {
    it('Should redirect', async () => {
      const res = await app.request('/linkedin')

      expect(res).not.toBeNull()
      expect(res.status).toBe(302)
    })

    it('Should throw error for invalide code', async () => {
      const res = await app.request('/linkedin?code=9348ffdsd-sdsdbad-code&state=secure-state')

      expect(res).not.toBeNull()
      expect(res.status).toBe(500)
      expect(await res.text()).toBe(linkedInCodeError.error)
    })

    it('Should work with received code', async () => {
      const res = await app.request(`/linkedin?code=${dummyCode}&state=secure-state`)
      const response = await res.json() as { token: Token, refreshToken: Token, user: LinkedInUser, grantedScopes: string[] }

      expect(res).not.toBeNull()
      expect(res.status).toBe(200)
      expect(response.user).toEqual(linkedInUser)
      expect(response.grantedScopes).toEqual(['email', 'openid', 'profile'])
      expect(response.token).toEqual({
        token: linkedInToken.access_token,
        expires_in: linkedInToken.expires_in
      })
      expect(response.refreshToken).toEqual({
        token: linkedInToken.refresh_token,
        expires_in: linkedInToken.refresh_token_expires_in
      })
    })
  })
})