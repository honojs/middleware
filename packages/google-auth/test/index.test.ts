import { Hono } from 'hono'
import { setupServer } from 'msw/node'

import type { GoogleAuthVariables, GoogleUser, Token} from '../src'
import { googleAuth } from '../src'
import { dummyToken, googleUser, handlers, dummyCode, googleCodeError, googleTokenError } from './handlers'

const server = setupServer(...handlers)
server.listen()

const client_id = '1jsdsldjkssd-4343dsasdsd34ghhn4-dummyid'
const client_secret = 'SDJS943hS_jj45dummysecret'

describe('googleAuth middleware', () => {
  const app = new Hono<{ Variables: GoogleAuthVariables }>()

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

  beforeAll(() => { server.listen() })
  afterEach(() => { server.resetHandlers() })
  afterAll(() => { server.close() })

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