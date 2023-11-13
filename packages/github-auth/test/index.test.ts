import { Hono } from 'hono'
import { setupServer } from 'msw/node'

import type { GithubUser, GithubAuthVariables, Token} from '../src'
import { githubAuth } from '../src'
import { handlers, githubUser, dummyCode, githubToken, githubCodeError } from './handlers'

const server = setupServer(...handlers)
server.listen()

const client_id = '1jsdsldjkssd-4343dsasdsd34ghhn4-dummyid'
const client_secret = 'SDJS943hS_jj45dummysecret'

describe('githubAuth middleware', () => {
  const app = new Hono<{ Variables: GithubAuthVariables }>()

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

  beforeAll(() => { server.listen() })
  afterEach(() => { server.resetHandlers() })
  afterAll(() => { server.close() })

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