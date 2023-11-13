import { Hono } from 'hono'
import { setupServer } from 'msw/node'

import type { LinkedInUser, LinkedinAuthVariables, Token} from '../src'
import { linkedInAuth } from '../src'
import { handlers, dummyCode, linkedInCodeError, linkedInUser, linkedInToken } from './handlers'

const server = setupServer(...handlers)
server.listen()

const client_id = '1jsdsldjkssd-4343dsasdsd34ghhn4-dummyid'
const client_secret = 'SDJS943hS_jj45dummysecret'

describe('linkedInAuth middleware', () => {
  const app = new Hono<{ Variables: LinkedinAuthVariables }>()

  app.use('linkedin', linkedInAuth({
    client_id,
    client_secret,
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