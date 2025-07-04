import { Hono } from 'hono'
import jwt from 'jsonwebtoken'
import type * as oauth2 from 'oauth4webapi'
import crypto from 'node:crypto'

const MOCK_ISSUER = 'https://accounts.google.com'
const MOCK_CLIENT_ID = 'CLIENT_ID_001'
const MOCK_CLIENT_SECRET = 'CLIENT_SECRET_001'
const MOCK_REDIRECT_URI = 'http://localhost/callback'
const MOCK_SUBJECT = 'USER_ID_001'
const MOCK_EMAIL = 'user001@example.com'
const MOCK_NAME = 'John Doe'
const MOCK_STATE = crypto.randomBytes(16).toString('hex') // 32 bytes
const MOCK_NONCE = crypto.randomBytes(16).toString('hex') // 32 bytes
const MOCK_AUTH_SECRET = crypto.randomBytes(16).toString('hex') // 32 bytes
const MOCK_AUTH_EXPIRES = '3600'
const MOCK_ID_TOKEN = jwt.sign(
  {
    iss: MOCK_ISSUER,
    aud: MOCK_CLIENT_ID,
    sub: MOCK_SUBJECT,
    email: MOCK_EMAIL,
    name: MOCK_NAME,
    exp: Math.floor(Date.now() / 1000) + 10 * 60, // 10 minutes
    nonce: MOCK_NONCE,
  },
  `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDDp5RtVoTDMre1
HZrPhMr3ic1fQPqRWnKs6f27DoBxA8JOsaHE15ApnLBlDLWKnoLoCNrHCuYGoh/+
WQuxS5LtyZb7Goe1DXjdoEohLjZS1kW0+PgDRCpzon1XHdjo5LdPV+ImhxSxeIFd
vn4NDEhQa5uKKCSZblvz3PgKR36AEM1313qcewgt5YgkQAvaBZFDI5C+FId8w8hf
rYL0W9GPGu4D/gfXHi74habcSni/HkEtRaqsnDh6JAi6pGZNeUnzeNHTcfFqj0ce
SSYTQNJhLqFrRUCLa9kQSOMcxRFBiUAcRGgjXiB4r9vZpIa1H3RGUNf2wOOxVxLF
dIl7dEzrAgMBAAECggEASjF+I4gviCXvbArx7ceZgA0NiBWH7x6xZcjFou1432Jh
iJ3rjk2AKYd1jJwpK4u4cG0LKXeEivdn0nfJ602RRgKv8kC5PXsCXmiuM67mgrsm
a94Njo+G2ZrAlQyIeKhiqv/Ujm+i9TmRNQ9LlX8W3QgxT06xsk0bKXqdxKgf3EfY
MUAQkD2sH7i/Wn2fBj9b6wdTsWQC7SRC7UgTvadvNoinILVyZxwjYY/3BZQRbMUm
687oCLSBeNdixxF9Ip1uvtNPBap6lvkZp1U9y1iteSftcLYd82ZvTvc4qjB800XU
RQRSkF5VddtHgT2kManF3hGjJHKeHsCaY6VyLxn5IQKBgQD42QtVweayQCTgL2VO
V+/SpP68hLTO4sfUz2FCuaW4F+6wvs0D3NUw7ZheCtuxr3enoIr5mrYx3BdR79ge
wQYBppofzXPXPKPQFtmHT3cwLXpwB6knyEMyJ3WpBVAPgcoJbYUOIRcO2eBgMxGR
9XMOU9FKLAsZ5TgDlJqd5pubZwKBgQDJRydu5OYKDtSRLbSxhOdJFF2fBb+ZcIAM
7exmaFUjQHSTiYr5DYraDdvue7JcvxIQFWJFCYdRGacRX9Rvjnvr1gRBHVb5+/FP
OLowCzWz+7F86MkQYd9SgmhD7MIG8XPlxR13NyIMglS49O6euNrB6oKCEYWDE8nB
ZS6TUSWT3QKBgQCs/nYa0AmIsX7xOwG6TPe0AG/2rmrjyFQTZXe/4z+Jk1mkFYCA
xuyObx4VgoboJ4uPRNRYYW13jAHKPGqKNrXuP9u1cCav4sAe0UO4BU5ed78+UpUN
yvKr0zLApajanufNVg3BnM9iy6RoPBhi17d8plhAsA2nmuot0wkJ7F8Q0QKBgECo
f+1q0M84VmbQ1PQV6qqaRTz5fsRO1IPSxpdbOsZZRVnD3IYHKKzFuPoSeIi8xJOw
GuJsnjCaWgYFz9uKXRq0pKc6Qp+JpMo7Qex/HWBVIX4r1bNSjYgW5mGzo9zRIdcV
DFMoveJg19CWtjT80yFqMUSRVl92MuDSnTSr47NtAoGBAJGu7TU6+qRGN6Bp38+A
jc1vz90U86BT9PnNbCzmVP3xdRfLLGZm6JWCVYNt1mm3/KAyK8bkviw4bHilcIMj
HfRCXKFdIfHsYcxAhUkKDpNguFv06xjbrlP6vPkqkp/4Td4sGQ8dAVmrcwpdv56o
UlMwcdSLCKw3qpSJOA08k7pz
-----END PRIVATE KEY-----`,
  { algorithm: 'RS256' }
)
const MOCK_JWT_ACTIVE_SESSION = jwt.sign(
  {
    sub: MOCK_SUBJECT,
    email: MOCK_EMAIL,
    rtk: 'DUMMY_REFRESH_TOKEN',
    rtkexp: Math.floor(Date.now() / 1000) + 10 * 60, // 10 minutes
    ssnexp: Math.floor(Date.now() / 1000) + 10 * 60, // 10 minutes
  },
  MOCK_AUTH_SECRET,
  { algorithm: 'HS256', expiresIn: '1h' }
)
const MOCK_JWT_TOKEN_EXPIRED_SESSION = jwt.sign(
  {
    sub: MOCK_SUBJECT,
    email: MOCK_EMAIL,
    rtk: 'DUMMY_REFRESH_TOKEN',
    rtkexp: Math.floor(Date.now() / 1000) - 1, // expired
    ssnexp: Math.floor(Date.now() / 1000) + 10 * 60, // 10 minutes
  },
  MOCK_AUTH_SECRET,
  { algorithm: 'HS256', expiresIn: '1h' }
)
const MOCK_JWT_EXPIRED_SESSION = jwt.sign(
  {
    sub: MOCK_SUBJECT,
    email: MOCK_EMAIL,
    rtk: 'DUMMY_REFRESH_TOKEN',
    rtkexp: Math.floor(Date.now() / 1000) - 1, // expired
    ssnexp: Math.floor(Date.now() / 1000) - 1, // expired
  },
  MOCK_AUTH_SECRET,
  { algorithm: 'HS256', expiresIn: '1h' }
)
const MOCK_JWT_INCORRECT_SECRET = jwt.sign(
  {
    sub: MOCK_SUBJECT,
    email: MOCK_EMAIL,
    rtk: 'DUMMY_REFRESH_TOKEN',
    rtkexp: Math.floor(Date.now() / 1000) + 10 * 60, // 10 minutes
    ssnexp: Math.floor(Date.now() / 1000) + 10 * 60, // 10 minutes
  },
  'incorrect-secret',
  { algorithm: 'HS256', expiresIn: '1h' }
)
const MOCK_JWT_INVALID_ALGORITHM = jwt.sign(
  {
    sub: MOCK_SUBJECT,
    email: MOCK_EMAIL,
    rtk: 'DUMMY_REFRESH_TOKEN',
    rtkexp: Math.floor(Date.now() / 1000) + 10 * 60, // 10 minutes
    ssnexp: Math.floor(Date.now() / 1000) + 10 * 60, // 10 minutes
  },
  null,
  { algorithm: 'none', expiresIn: '1h' }
)
vi.mock(import('oauth4webapi'), async (importOriginal) => {
  const original = await importOriginal()

  return {
    ...original,
    discoveryRequest: vi.fn(async () => {
      return new Response(
        JSON.stringify({
          issuer: MOCK_ISSUER,
          authorization_endpoint: `${MOCK_ISSUER}/auth`,
          token_endpoint: `${MOCK_ISSUER}/token`,
          revocation_endpoint: `${MOCK_ISSUER}/revoke`,
          scopes_supported: ['openid', 'email', 'profile'],
        })
      )
    }),
    generateRandomState: vi.fn(() => MOCK_STATE),
    generateRandomNonce: vi.fn(() => MOCK_NONCE),
    authorizationCodeGrantRequest: vi.fn(async () => {
      return new Response(
        JSON.stringify({
          access_token: 'DUMMY_ACCESS_TOKEN',
          expires_in: 3599,
          refresh_token: 'DUUMMY_REFRESH_TOKEN',
          scope: 'https://www.googleapis.com/auth/userinfo.email openid',
          token_type: 'Bearer',
          id_token: MOCK_ID_TOKEN,
        })
      )
    }),
    refreshTokenGrantRequest: vi.fn(async () => {
      return new Response(
        JSON.stringify({
          access_token: 'DUMMY_ACCESS_TOKEN',
          expires_in: 3599,
          refresh_token: 'DUUMMY_REFRESH_TOKEN_RENEWED',
          scope: 'https://www.googleapis.com/auth/userinfo.email openid',
          token_type: 'Bearer',
          id_token: MOCK_ID_TOKEN,
        })
      )
    }),
    revocationRequest: vi.fn(async () => {
      return new Response(JSON.stringify({}))
    }),
  }
})

const {
  oidcAuthMiddleware,
  getAuth,
  processOAuthCallback,
  revokeSession,
  initOidcAuthMiddleware,
  getClient,
} = await import('.')

const app = new Hono()
app.get('/logout', async (c) => {
  await revokeSession(c)
  return c.text('OK')
})
app.get('/callback-custom', async (c) => {
  c.set('oidcClaimsHook', async (orig, claims, response) => ({
    name: (claims?.name as string) ?? orig?.name ?? '',
    sub: claims?.sub ?? orig?.sub ?? '',
    token: response.access_token,
  }))
  return processOAuthCallback(c)
})
app.use('/*', oidcAuthMiddleware())
app.all('/*', async (c) => {
  const auth = await getAuth(c)
  return c.text(`Hello ${auth?.email}! Refresh token: ${auth?.rtk}`)
})

beforeEach(() => {
  process.env.OIDC_ISSUER = MOCK_ISSUER
  process.env.OIDC_CLIENT_ID = MOCK_CLIENT_ID
  process.env.OIDC_CLIENT_SECRET = MOCK_CLIENT_SECRET
  process.env.OIDC_REDIRECT_URI = MOCK_REDIRECT_URI
  process.env.OIDC_AUTH_SECRET = MOCK_AUTH_SECRET
  process.env.OIDC_AUTH_EXPIRES = MOCK_AUTH_EXPIRES
  delete process.env.OIDC_SCOPES
  delete process.env.OIDC_COOKIE_PATH
  delete process.env.OIDC_COOKIE_NAME
  delete process.env.OIDC_COOKIE_DOMAIN
  delete process.env.OIDC_AUDIENCE
  delete process.env.OIDC_AUTH_EXTERNAL_URL
})
describe('oidcAuthMiddleware()', () => {
  test('Should respond with 200 OK if session is active', async () => {
    const req = new Request('http://localhost/', {
      method: 'GET',
      headers: { cookie: `oidc-auth=${MOCK_JWT_ACTIVE_SESSION}` },
    })
    const res = await app.request(req, {}, {})
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(await res.text()).toBe(`Hello ${MOCK_EMAIL}! Refresh token: DUMMY_REFRESH_TOKEN`)
  })
  test('Should respond with 200 OK with renewed refresh token', async () => {
    const req = new Request('http://localhost/', {
      method: 'GET',
      headers: { cookie: `oidc-auth=${MOCK_JWT_TOKEN_EXPIRED_SESSION}` },
    })
    const res = await app.request(req, {}, {})
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(await res.text()).toBe(
      `Hello ${MOCK_EMAIL}! Refresh token: DUUMMY_REFRESH_TOKEN_RENEWED`
    )
  })
  test('Should redirect to authorization endpoint if session is expired', async () => {
    const req = new Request('http://localhost/', {
      method: 'GET',
      headers: { cookie: `oidc-auth=${MOCK_JWT_EXPIRED_SESSION}` },
    })
    const res = await app.request(req, {}, {})
    expect(res).not.toBeNull()
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toMatch(/scope=openid(%20|\+)email(%20|\+)profile&/)
    expect(res.headers.get('location')).toMatch('access_type=offline&prompt=consent')
    expect(res.headers.get('set-cookie')).toMatch(`state=${MOCK_STATE}`)
    expect(res.headers.get('set-cookie')).toMatch(`nonce=${MOCK_NONCE}`)
    expect(res.headers.get('set-cookie')).toMatch('code_verifier=')
    expect(res.headers.get('set-cookie')).toMatch('continue=http%3A%2F%2Flocalhost%2F')
  })
  test('Should use custom scope, if defined', async () => {
    process.env.OIDC_SCOPES = 'openid email'
    const req = new Request('http://localhost/', {
      method: 'GET',
      headers: { cookie: `oidc-auth=${MOCK_JWT_EXPIRED_SESSION}` },
    })
    const res = await app.request(req, {}, {})
    expect(res).not.toBeNull()
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toMatch(/scope=openid(%20|\+)email&/)
    expect(res.headers.get('location')).toMatch('access_type=offline&prompt=consent')
    expect(res.headers.get('set-cookie')).toMatch(`state=${MOCK_STATE}`)
    expect(res.headers.get('set-cookie')).toMatch(`nonce=${MOCK_NONCE}`)
    expect(res.headers.get('set-cookie')).toMatch('code_verifier=')
    expect(res.headers.get('set-cookie')).toMatch('continue=http%3A%2F%2Flocalhost%2F')
  })
  test('Custom scope is limited to supported scopes', async () => {
    process.env.OIDC_SCOPES = 'openid email salary'
    const req = new Request('http://localhost/', {
      method: 'GET',
      headers: { cookie: `oidc-auth=${MOCK_JWT_EXPIRED_SESSION}` },
    })
    const res = await app.request(req, {}, {})
    expect(res).not.toBeNull()
    expect(res.status).toBe(500)
  })
  test('Should redirect to authorization endpoint if no session cookie is found', async () => {
    const req = new Request('http://localhost/', {
      method: 'GET',
    })
    const res = await app.request(req, {}, {})
    expect(res).not.toBeNull()
    expect(res.status).toBe(302)
  })
  test('Should delete session and redirect to authorization endpoint if the key of the session JWT is icorrect', async () => {
    const req = new Request('http://localhost/', {
      method: 'GET',
      headers: { cookie: `oidc-auth=${MOCK_JWT_INCORRECT_SECRET}` },
    })
    const res = await app.request(req, {}, {})
    expect(res).not.toBeNull()
    expect(res.status).toBe(302)
    expect(res.headers.get('set-cookie')).toMatch(new RegExp('oidc-auth=; Max-Age=0; Path=/($|,)'))
  })
  test('Should delete session and redirect to authorization endpoint if the algorithm of the session JWT is invalid', async () => {
    const req = new Request('http://localhost/', {
      method: 'GET',
      headers: { cookie: `oidc-auth=${MOCK_JWT_INVALID_ALGORITHM}` },
    })
    const res = await app.request(req, {}, {})
    expect(res).not.toBeNull()
    expect(res.status).toBe(302)
    expect(res.headers.get('set-cookie')).toMatch(new RegExp('oidc-auth=; Max-Age=0; Path=/($|,)'))
  })
  test('Should return an error when OIDC_ISSUER is undefined', async () => {
    delete process.env.OIDC_ISSUER
    const req = new Request('http://localhost/', {
      method: 'GET',
      headers: { cookie: `oidc-auth=${MOCK_JWT_ACTIVE_SESSION}` },
    })
    const res = await app.request(req, {}, {})
    expect(res).not.toBeNull()
    expect(res.status).toBe(500)
  })
  test('Should return an error when OIDC_CLIENT_ID is undefined', async () => {
    delete process.env.OIDC_CLIENT_ID
    const req = new Request('http://localhost/', {
      method: 'GET',
      headers: { cookie: `oidc-auth=${MOCK_JWT_ACTIVE_SESSION}` },
    })
    const res = await app.request(req, {}, {})
    expect(res).not.toBeNull()
    expect(res.status).toBe(500)
  })
  test('Should return an error when OIDC_CLIENT_SECRET is undefined', async () => {
    delete process.env.OIDC_CLIENT_SECRET
    const req = new Request('http://localhost/', {
      method: 'GET',
      headers: { cookie: `oidc-auth=${MOCK_JWT_ACTIVE_SESSION}` },
    })
    const res = await app.request(req, {}, {})
    expect(res).not.toBeNull()
    expect(res.status).toBe(500)
  })
  test('Should return an error when OIDC_REDIRECT_URI is a relative path', async () => {
    process.env.OIDC_REDIRECT_URI = '../callback'
    const req = new Request('http://localhost/', {
      method: 'GET',
      headers: { cookie: `oidc-auth=${MOCK_JWT_ACTIVE_SESSION}` },
    })
    const res = await app.request(req, {}, {})
    expect(res).not.toBeNull()
    expect(res.status).toBe(500)
  })
  test('Should return an error when OIDC_AUTH_SECRET is undefined', async () => {
    delete process.env.OIDC_AUTH_SECRET
    const req = new Request('http://localhost/', {
      method: 'GET',
      headers: { cookie: `oidc-auth=${MOCK_JWT_ACTIVE_SESSION}` },
    })
    const res = await app.request(req, {}, {})
    expect(res).not.toBeNull()
    expect(res.status).toBe(500)
  })
  test('Should return an error when OIDC_AUTH_SECRET is too short', async () => {
    process.env.OIDC_AUTH_SECRET = '1234567890123456789012345678901'
    const req = new Request('http://localhost/', {
      method: 'GET',
      headers: { cookie: `oidc-auth=${MOCK_JWT_ACTIVE_SESSION}` },
    })
    const res = await app.request(req, {}, {})
    expect(res).not.toBeNull()
    expect(res.status).toBe(500)
  })
  test('Should Domain attribute of the cookie not set if env value not defined', async () => {
    const req = new Request('http://localhost/', {
      method: 'GET',
      headers: { cookie: `oidc-auth=${MOCK_JWT_EXPIRED_SESSION}` },
    })
    const res = await app.request(req, {}, {})
    expect(res).not.toBeNull()
    expect(res.status).toBe(302)
    expect(res.headers.get('set-cookie')).not.toMatch('Domain=')
  })
  test('Should Domain attribute of the cookie set if env value defined (with renewed refresh token)', async () => {
    const MOCK_COOKIE_DOMAIN = (process.env.OIDC_COOKIE_DOMAIN = 'example.com')
    const req = new Request('http://localhost/', {
      method: 'GET',
      headers: { cookie: `oidc-auth=${MOCK_JWT_TOKEN_EXPIRED_SESSION}` },
    })
    const res = await app.request(req, {}, {})
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(res.headers.get('set-cookie')).toMatch(`Domain=${MOCK_COOKIE_DOMAIN}`)
  })
  test('Should Domain attribute of the cookie set if env value defined (if session is expired)', async () => {
    const MOCK_COOKIE_DOMAIN = (process.env.OIDC_COOKIE_DOMAIN = 'example.com')
    const req = new Request('http://localhost/', {
      method: 'GET',
      headers: { cookie: `oidc-auth=${MOCK_JWT_EXPIRED_SESSION}` },
    })
    const res = await app.request(req, {}, {})
    expect(res).not.toBeNull()
    expect(res.status).toBe(302)
    expect(res.headers.get('set-cookie')).toMatch(`Domain=${MOCK_COOKIE_DOMAIN}`)
  })
  test('Should use custom audience if defined', async () => {
    process.env.OIDC_AUDIENCE = 'audience'
    const req = new Request('http://localhost/', {
      method: 'GET',
      headers: { cookie: `oidc-auth=${MOCK_JWT_EXPIRED_SESSION}` },
    })
    const res = await app.request(req, {}, {})
    expect(res).not.toBeNull()
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toMatch(/audience=audience/)
  })
  test('Should not set audience if not defined', async () => {
    const req = new Request('http://localhost/', {
      method: 'GET',
      headers: { cookie: `oidc-auth=${MOCK_JWT_EXPIRED_SESSION}` },
    })
    const res = await app.request(req, {}, {})
    expect(res).not.toBeNull()
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).not.toMatch(/audience=/)
  })
  test('Should use external URL for continue cookie when OIDC_AUTH_EXTERNAL_URL is set', async () => {
    process.env.OIDC_AUTH_EXTERNAL_URL = 'https://public.example.com/app'
    const req = new Request('http://internal.host/sub/path?q=1#hash', {
      method: 'GET',
      headers: { cookie: `oidc-auth=${MOCK_JWT_EXPIRED_SESSION}` },
    })
    const res = await app.request(req, {}, {})
    expect(res).not.toBeNull()
    expect(res.status).toBe(302)
    const expectedContinueUrl = 'https://public.example.com/app/sub/path?q=1#hash'
    expect(res.headers.get('set-cookie')).toMatch(
      `continue=${encodeURIComponent(expectedContinueUrl)}`
    )
  })
  test('Should return an error when OIDC_AUTH_EXTERNAL_URL is an invalid URL', async () => {
    process.env.OIDC_AUTH_EXTERNAL_URL = 'invalid-url'
    const req = new Request('http://localhost/', {
      method: 'GET',
      headers: { cookie: `oidc-auth=${MOCK_JWT_EXPIRED_SESSION}` },
    })
    const res = await app.request(req, {}, {})
    expect(res).not.toBeNull()
    expect(res.status).toBe(500)
  })
})
describe('processOAuthCallback()', () => {
  test('Should successfully process the OAuth2.0 callback and redirect to the continue URL', async () => {
    const req = new Request(`${MOCK_REDIRECT_URI}?code=1234&state=${MOCK_STATE}`, {
      method: 'GET',
      headers: {
        cookie: `state=${MOCK_STATE}; nonce=${MOCK_NONCE}; code_verifier=1234; continue=http%3A%2F%2Flocalhost%2F1234`,
      },
    })
    const res = await app.request(req, {}, {})
    const { email, name, sub } = JSON.parse(
      atob(
        res.headers
          .get('set-cookie')
          ?.match(/oidc-auth=[^;]+/)?.[0]
          ?.split('.')[1] as string
      )
    )
    expect(sub).toBe(MOCK_SUBJECT)
    expect(email).toBe(MOCK_EMAIL)
    expect(name).toBeUndefined()
    expect(res).not.toBeNull()
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('http://localhost/1234')
  })
  test('Verify default callback path when OIDC_REDIRECT_URI is undefined', async () => {
    delete process.env.OIDC_REDIRECT_URI
    const req = new Request(`${MOCK_REDIRECT_URI}?code=1234&state=${MOCK_STATE}`, {
      method: 'GET',
      headers: {
        cookie: `state=${MOCK_STATE}; nonce=${MOCK_NONCE}; code_verifier=1234; continue=http%3A%2F%2Flocalhost%2F1234`,
      },
    })
    const res = await app.request(req, {}, {})
    expect(res).not.toBeNull()
    expect(res.status).toBe(302)
  })
  test('Should respond with customized claims', async () => {
    const req = new Request(`${MOCK_REDIRECT_URI}-custom?code=1234&state=${MOCK_STATE}`, {
      method: 'GET',
      headers: {
        cookie: `state=${MOCK_STATE}; nonce=${MOCK_NONCE}; code_verifier=1234; continue=http%3A%2F%2Flocalhost%2F1234`,
      },
    })
    const res = await app.request(req, {}, {})
    const { email, name, sub } = JSON.parse(
      atob(
        res.headers
          .get('set-cookie')
          ?.match(/oidc-auth=[^;]+/)?.[0]
          ?.split('.')[1] as string
      )
    )
    expect(sub).toBe(MOCK_SUBJECT)
    expect(email).toBeUndefined()
    expect(name).toBe(MOCK_NAME)
    const path = new URL(MOCK_REDIRECT_URI).pathname
    expect(res).not.toBeNull()
    expect(res.status).toBe(302)
    expect(res.headers.get('set-cookie')).toMatch(
      new RegExp(`state=; Max-Age=0; Path=${path}($|,)`)
    )
    expect(res.headers.get('set-cookie')).toMatch(
      new RegExp(`nonce=; Max-Age=0; Path=${path}($|,)`)
    )
    expect(res.headers.get('set-cookie')).toMatch(
      new RegExp(`code_verifier=; Max-Age=0; Path=${path}($|,)`)
    )
    expect(res.headers.get('set-cookie')).toMatch(
      new RegExp(`continue=; Max-Age=0; Path=${path}($|,)`)
    )
    expect(res.headers.get('set-cookie')).toMatch(
      new RegExp('oidc-auth=[^;]+; Path=/; HttpOnly; Secure')
    )
    expect(res.headers.get('location')).toBe('http://localhost/1234')
  })
  test('Should restrict the auth cookie to a given path', async () => {
    const MOCK_COOKIE_PATH = (process.env.OIDC_COOKIE_PATH = '/some/subpath/for/authentication')
    process.env.OIDC_REDIRECT_URI = `http://localhost${MOCK_COOKIE_PATH}/callback`
    const parentApp = new Hono().route(MOCK_COOKIE_PATH, app)
    const path = new URL(process.env.OIDC_REDIRECT_URI).pathname
    const req = new Request(`${process.env.OIDC_REDIRECT_URI}?code=1234&state=${MOCK_STATE}`, {
      method: 'GET',
      headers: {
        cookie: `state=${MOCK_STATE}; nonce=${MOCK_NONCE}; code_verifier=1234; continue=http%3A%2F%2Flocalhost%2F1234`,
      },
    })
    const res = await parentApp.request(req, {}, {})
    expect(res).not.toBeNull()
    expect(res.status).toBe(302)
    expect(res.headers.get('set-cookie')).toMatch(
      new RegExp(`state=; Max-Age=0; Path=${path}($|,)`)
    )
    expect(res.headers.get('set-cookie')).toMatch(
      new RegExp(`nonce=; Max-Age=0; Path=${path}($|,)`)
    )
    expect(res.headers.get('set-cookie')).toMatch(
      new RegExp(`code_verifier=; Max-Age=0; Path=${path}($|,)`)
    )
    expect(res.headers.get('set-cookie')).toMatch(
      new RegExp(`continue=; Max-Age=0; Path=${path}($|,)`)
    )
    expect(res.headers.get('set-cookie')).toMatch(
      new RegExp(`oidc-auth=[^;]+; Path=${process.env.OIDC_COOKIE_PATH}; HttpOnly; Secure`)
    )
    expect(res.headers.get('location')).toBe('http://localhost/1234')
  })
  test('Should respond with custom cookie name', async () => {
    const MOCK_COOKIE_NAME = (process.env.OIDC_COOKIE_NAME = 'custom-auth-cookie')
    const defaultOidcAuthCookiePath = '/'
    const req = new Request(`${MOCK_REDIRECT_URI}?code=1234&state=${MOCK_STATE}`, {
      method: 'GET',
      headers: {
        cookie: `state=${MOCK_STATE}; nonce=${MOCK_NONCE}; code_verifier=1234; continue=http%3A%2F%2Flocalhost%2F1234`,
      },
    })
    const res = await app.request(req, {}, {})
    expect(res).not.toBeNull()
    expect(res.status).toBe(302)
    expect(res.headers.get('set-cookie')).toMatch(
      new RegExp(`${MOCK_COOKIE_NAME}=[^;]+; Path=${defaultOidcAuthCookiePath}; HttpOnly; Secure`)
    )
  })
  test('Should return an error if the state parameter does not match', async () => {
    const req = new Request(`${MOCK_REDIRECT_URI}?code=1234&state=${MOCK_STATE}`, {
      method: 'GET',
      headers: {
        cookie: `state=abcd; nonce=${MOCK_NONCE}; code_verifier=1234; continue=http%3A%2F%2Flocalhost%2F1234`,
      },
    })
    const res = await app.request(req, {}, {})
    expect(res).not.toBeNull()
    expect(res.status).toBe(500)
  })
  test('Should return an error if the code parameter is missing', async () => {
    const req = new Request(`${MOCK_REDIRECT_URI}?state=${MOCK_STATE}`, {
      method: 'GET',
      headers: {
        cookie: `state=${MOCK_STATE}; nonce=${MOCK_NONCE}; code_verifier=1234; continue=http%3A%2F%2Flocalhost%2F1234`,
      },
    })
    const res = await app.request(req, {}, {})
    expect(res).not.toBeNull()
    expect(res.status).toBe(500)
  })
  test('Should return an error if received OAuth2.0 error', async () => {
    const req = new Request(
      `${MOCK_REDIRECT_URI}?error=invalid_grant&error_description=Bad+Request&state=1234`,
      {
        method: 'GET',
        headers: { cookie: 'state=1234; nonce=1234; code_verifier=1234' },
      }
    )
    const res = await app.request(req, {}, {})
    expect(res).not.toBeNull()
    expect(res.status).toBe(500)
  })
})
describe('RevokeSession()', () => {
  test('Should successfully revoke the session', async () => {
    const req = new Request('http://localhost/logout', {
      method: 'GET',
      headers: { cookie: `oidc-auth=${MOCK_JWT_ACTIVE_SESSION}` },
    })
    const res = await app.request(req, {}, {})
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(res.headers.get('set-cookie')).toMatch(new RegExp('oidc-auth=; Max-Age=0; Path=/($|,)'))
  })
  test('Should revoke the session of the given path', async () => {
    const MOCK_COOKIE_PATH = (process.env.OIDC_COOKIE_PATH = '/some/subpath/for/authentication')
    const parentApp = new Hono().route(MOCK_COOKIE_PATH, app)
    const req = new Request(`http://localhost${MOCK_COOKIE_PATH}/logout`, {
      method: 'GET',
      headers: { cookie: `oidc-auth=${MOCK_JWT_ACTIVE_SESSION}` },
    })
    const res = await parentApp.request(req, {}, {})
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(res.headers.get('set-cookie')).toMatch(
      new RegExp(`oidc-auth=; Max-Age=0; Path=${MOCK_COOKIE_PATH}($|,)`)
    )
  })
})
describe('initOidcAuthMiddleware()', () => {
  test('Should error if not called first in context', async () => {
    const app = new Hono()
    app.use('/*', oidcAuthMiddleware())
    app.use(initOidcAuthMiddleware({}))
    const req = new Request('http://localhost/', {
      method: 'GET',
      headers: { cookie: `oidc-auth=${MOCK_JWT_ACTIVE_SESSION}` },
    })
    const res = await app.request(req, {}, {})
    expect(res).not.toBeNull()
    expect(res.status).toBe(500)
  })
  test('Should prefer programmatically configured varaiables', async () => {
    let client: oauth2.Client | undefined
    const CUSTOM_OIDC_CLIENT_ID = 'custom-client-id'
    const CUSTOM_OIDC_CLIENT_SECRET = 'custom-client-secret'
    const app = new Hono()
    app.use(
      initOidcAuthMiddleware({
        OIDC_CLIENT_ID: CUSTOM_OIDC_CLIENT_ID,
        OIDC_CLIENT_SECRET: CUSTOM_OIDC_CLIENT_SECRET,
      })
    )
    app.use(async (c) => {
      client = getClient(c)
      return c.text('finished')
    })
    const req = new Request('http://localhost/', {
      method: 'GET',
    })
    const res = await app.request(req, {}, {})
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(client?.client_id).toBe(CUSTOM_OIDC_CLIENT_ID)
    expect(client?.client_secret).toBe(CUSTOM_OIDC_CLIENT_SECRET)
  })
})
