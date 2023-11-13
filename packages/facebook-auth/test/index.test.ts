import { Hono } from 'hono'
import { setupServer } from 'msw/node'

import type { FacebookAuthVariables, FacebookUser, Token} from '../src'
import { facebookAuth } from '../src'
import { dummyToken, handlers, facebookUser, dummyCode, facebookCodeError, facebookTokenError } from './handlers'

const server = setupServer(...handlers)
server.listen()

const client_id = '1jsdsldjkssd-4343dsasdsd34ghhn4-dummyid'
const client_secret = 'SDJS943hS_jj45dummysecret'

describe('facebookAuth middleware', () => {
  const app = new Hono<{ Variables: FacebookAuthVariables }>()

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

  beforeAll(() => { server.listen() })
  afterEach(() => { server.resetHandlers() })
  afterAll(() => { server.close() })

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

    it('Should throw error for invalid code', async () => {
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
      const res = await app.request('/facebook/token?#access_token=${dummyToken.access_token}&expires_in=${dummyToken.expires_in}&state=secure-state')

      expect(res).not.toBeNull()
      expect(res.status).toBe(200)
    })

    it('Prevent CSRF attack', async () => {
      const res = await app.request(`/facebook/token?access_token=${dummyToken.access_token}&expires_in=${dummyToken.expires_in}&state=malware-state`)
      expect(res).not.toBeNull()
      expect(res.status).toBe(401)
    })

    it('Should throw error for invalid token', async () => {
      const res = await app.request('/facebook/token?access_token=9348ffdsd-sdsdbad-invalidtoken&state=secure-state')

      expect(res).not.toBeNull()
      expect(res.status).toBe(500)
      expect(await res.text()).toBe(facebookTokenError.error.message)
    })

    it('Should work with received token', async () => {
      const res = await app.request(`/facebook/token?access_token=${dummyToken.access_token}&expires_in=${dummyToken.expires_in}&state=secure-state&granted_scopes=openid,email,profile`)
      const response = await res.json() as { token: Token, user: FacebookUser, grantedScopes: string[] }

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