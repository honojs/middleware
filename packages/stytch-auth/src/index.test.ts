import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { HTTPException } from 'hono/http-exception'
import type { Mock } from 'vitest'
import { Consumer, B2B } from '.'

type sessionMock = {
  authenticate: Mock
  authenticateJwt: Mock
}

type oauthMock = {
  introspectTokenLocal: Mock
}

type b2bSessionMock = {
  authenticate: Mock
  authenticateJwt: Mock
}

type b2bIdpMock = {
  introspectTokenLocal: Mock
}

vi.mock(import('stytch'), async (importOriginal) => {
  const original = await importOriginal()
  const ConsumerSessions: sessionMock = {
    authenticate: vi.fn(),
    authenticateJwt: vi.fn(),
  }
  const ConsumerOAuth: oauthMock = {
    introspectTokenLocal: vi.fn(),
  }
  const B2BSessions: b2bSessionMock = {
    authenticate: vi.fn(),
    authenticateJwt: vi.fn(),
  }
  const B2BIdp: b2bIdpMock = {
    introspectTokenLocal: vi.fn(),
  }
  vi.stubGlobal('__stytchConsumersessionMock', ConsumerSessions)
  vi.stubGlobal('__stytchConsumerOAuthMock', ConsumerOAuth)
  vi.stubGlobal('__stytchB2BsessionMock', B2BSessions)
  vi.stubGlobal('__stytchB2BIdpMock', B2BIdp)

  // Forcing the mocked class constructor to be a real type causes tsc to crash
  // e.g. same error as https://github.com/microsoft/TypeScript/issues/52952 but probably different bug
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ConsumerClient: any = vi.fn(function (this: any, { project_id, secret, custom_base_url }) {
    this.project_id = project_id
    this.secret = secret
    this.custom_base_url = custom_base_url
    this.sessions = ConsumerSessions
    this.idp = ConsumerOAuth
  })

  // Forcing the mocked class constructor to be a real type causes tsc to crash
  // e.g. same error as https://github.com/microsoft/TypeScript/issues/52952 but probably different bug
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const B2BClientMock: any = vi.fn(function (this: any, { project_id, secret, custom_base_url }) {
    this.project_id = project_id
    this.secret = secret
    this.custom_base_url = custom_base_url
    this.sessions = B2BSessions
    this.idp = B2BIdp
  })
  return {
    ...original,
    Client: ConsumerClient,
    B2BClient: B2BClientMock,
  }
})

describe('Consumer', () => {
  //@ts-expect-error set on globalThis in vi.mock
  const sessionMock = __stytchConsumersessionMock as sessionMock
  //@ts-expect-error set on globalThis in vi.mock
  const oauthMock = __stytchConsumerOAuthMock as oauthMock
  beforeEach(() => {
    vi.stubEnv('STYTCH_PROJECT_ID', 'project-test-xxxxx')
    vi.stubEnv('STYTCH_PROJECT_SECRET', 'secret-key-test-xxxxx')
    vi.stubEnv('STYTCH_DOMAIN', 'https://login.example.com')
  })
  describe('getClient', () => {
    test('Instantiates client from ctx for handlers to use', async () => {
      const app = new Hono()

      const req = new Request('http://localhost/')
      app.get('/', (ctx) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const client = Consumer.getClient(ctx) as any
        return ctx.json({
          project_id: client.project_id,
          secret: client.secret,
          custom_base_url: client.custom_base_url,
        })
      })

      const response = await app.request(req)

      expect(response.status).toEqual(200)
      expect(await response.json()).toEqual({
        project_id: 'project-test-xxxxx',
        secret: 'secret-key-test-xxxxx',
        custom_base_url: 'https://login.example.com',
      })
    })
  })
  describe('authenticateSessionLocal', () => {
    it('authenticates with default cookie, stores session, and retrieves via getStytchSession', async () => {
      const mockSession = { session_id: 'session_123', user_id: 'user_123' }
      sessionMock.authenticateJwt.mockResolvedValue({ session: mockSession })

      const app = new Hono()
      app.use('*', Consumer.authenticateSessionLocal())
      app.get('/', (c) => {
        const session = Consumer.getStytchSession(c)
        return c.json({ session_id: session.session_id })
      })

      const req = new Request('http://localhost/', {
        headers: { Cookie: 'stytch_session_jwt=jwt_token_123' },
      })
      const response = await app.request(req)

      expect(sessionMock.authenticateJwt).toHaveBeenCalledWith({
        session_jwt: 'jwt_token_123',
        max_token_age_seconds: undefined,
      })
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ session_id: 'session_123' })
    })

    it('uses custom getCredential with custom cookie name', async () => {
      const mockSession = { session_id: 'session_456', user_id: 'user_456' }
      sessionMock.authenticateJwt.mockResolvedValue({ session: mockSession })

      const app = new Hono()
      app.use(
        '*',
        Consumer.authenticateSessionLocal({
          getCredential: (c) => ({ session_jwt: getCookie(c, 'custom_jwt_cookie') ?? '' }),
        })
      )
      app.get('/', (c) => {
        const session = Consumer.getStytchSession(c)
        return c.json({ session_id: session.session_id })
      })

      const req = new Request('http://localhost/', {
        headers: { Cookie: 'custom_jwt_cookie=custom_jwt_token' },
      })
      const response = await app.request(req)

      expect(sessionMock.authenticateJwt).toHaveBeenCalledWith({
        session_jwt: 'custom_jwt_token',
        max_token_age_seconds: undefined,
      })
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ session_id: 'session_456' })
    })

    it('passes maxTokenAgeSeconds to authenticateJwt', async () => {
      const mockSession = { session_id: 'session_789', user_id: 'user_789' }
      sessionMock.authenticateJwt.mockResolvedValue({ session: mockSession })

      const app = new Hono()
      app.use('*', Consumer.authenticateSessionLocal({ maxTokenAgeSeconds: 3600 }))
      app.get('/', (c) => c.json({ ok: true }))

      const req = new Request('http://localhost/', {
        headers: { Cookie: 'stytch_session_jwt=jwt_token_789' },
      })
      await app.request(req)

      expect(sessionMock.authenticateJwt).toHaveBeenCalledWith({
        session_jwt: 'jwt_token_789',
        max_token_age_seconds: 3600,
      })
    })
  })

  describe('authenticateSessionRemote', () => {
    it('authenticates with default cookie, stores session and user, and retrieves via getStytchSession/getStytchUser', async () => {
      const mockSession = { session_id: 'session_remote_123', user_id: 'user_remote_123' }
      const mockUser = { user_id: 'user_remote_123', name: { first_name: 'John' } }
      sessionMock.authenticate.mockResolvedValue({ session: mockSession, user: mockUser })

      const app = new Hono()
      app.use('*', Consumer.authenticateSessionRemote())
      app.get('/', (c) => {
        const session = Consumer.getStytchSession(c)
        const user = Consumer.getStytchUser(c)
        return c.json({ session_id: session.session_id, user_id: user.user_id })
      })

      const req = new Request('http://localhost/', {
        headers: { Cookie: 'stytch_session_jwt=jwt_token_remote_123' },
      })
      const response = await app.request(req)

      expect(sessionMock.authenticate).toHaveBeenCalledWith({
        session_jwt: 'jwt_token_remote_123',
      })
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        session_id: 'session_remote_123',
        user_id: 'user_remote_123',
      })
    })

    it('uses custom getCredential with session_token', async () => {
      const mockSession = { session_id: 'session_token_456', user_id: 'user_token_456' }
      const mockUser = { user_id: 'user_token_456', name: { first_name: 'Jane' } }
      sessionMock.authenticate.mockResolvedValue({ session: mockSession, user: mockUser })

      const app = new Hono()
      app.use(
        '*',
        Consumer.authenticateSessionRemote({
          getCredential: (c) => ({ session_token: getCookie(c, 'stytch_session_token') ?? '' }),
        })
      )
      app.get('/', (c) => {
        const user = Consumer.getStytchUser(c)
        return c.json({ user_id: user.user_id })
      })

      const req = new Request('http://localhost/', {
        headers: { Cookie: 'stytch_session_token=session_token_value' },
      })
      const response = await app.request(req)

      expect(sessionMock.authenticate).toHaveBeenCalledWith({
        session_token: 'session_token_value',
      })
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ user_id: 'user_token_456' })
    })
  })

  describe('authenticateSessionLocal onError', () => {
    it('calls onError callback when JWT authentication fails', async () => {
      sessionMock.authenticateJwt.mockRejectedValue(new Error('Invalid JWT'))
      const mockOnError = vi.fn()

      const app = new Hono()
      app.use(
        '*',
        Consumer.authenticateSessionLocal({
          onError: mockOnError,
        })
      )
      app.get('/', (c) => c.json({ ok: true }))

      const req = new Request('http://localhost/', {
        headers: { Cookie: 'stytch_session_jwt=invalid_jwt' },
      })
      const response = await app.request(req)

      expect(mockOnError).toHaveBeenCalled()
      expect(response.status).toBe(401)
    })

    it('uses onError return value when provided', async () => {
      sessionMock.authenticateJwt.mockRejectedValue(new Error('Invalid JWT'))

      const app = new Hono()
      app.use(
        '*',
        Consumer.authenticateSessionLocal({
          onError: (c) => {
            return c.redirect('/login')
          },
        })
      )
      app.get('/', (c) => c.json({ ok: true }))

      const req = new Request('http://localhost/', {
        headers: { Cookie: 'stytch_session_jwt=invalid_jwt' },
      })
      const response = await app.request(req)

      expect(response.status).toBe(302)
      expect(response.headers.get('Location')).toBe('/login')
    })
  })

  describe('authenticateSessionRemote onError', () => {
    it('calls onError callback when remote authentication fails', async () => {
      sessionMock.authenticate.mockRejectedValue(new Error('Session expired'))
      const mockOnError = vi.fn()

      const app = new Hono()
      app.use(
        '*',
        Consumer.authenticateSessionRemote({
          onError: mockOnError,
        })
      )
      app.get('/', (c) => c.json({ ok: true }))

      const req = new Request('http://localhost/', {
        headers: { Cookie: 'stytch_session_jwt=expired_jwt' },
      })
      const response = await app.request(req)

      expect(mockOnError).toHaveBeenCalled()
      expect(response.status).toBe(401)
    })

    it('demonstrates onError with WWW-Authenticate header', async () => {
      sessionMock.authenticate.mockRejectedValue(new Error('Session expired'))

      const app = new Hono()
      app.use(
        '*',
        Consumer.authenticateSessionRemote({
          onError: () => {
            const errorResponse = new Response('Session expired', {
              status: 401,
              headers: {
                'WWW-Authenticate': 'Bearer realm="app"',
              },
            })
            throw new HTTPException(401, { res: errorResponse })
          },
        })
      )
      app.get('/', (c) => c.json({ ok: true }))

      const req = new Request('http://localhost/', {
        headers: { Cookie: 'stytch_session_jwt=expired_jwt' },
      })
      const response = await app.request(req)

      expect(response.status).toBe(401)
      expect(response.headers.get('WWW-Authenticate')).toBe('Bearer realm="app"')
    })
  })

  describe('getStytchSession', () => {
    it('throws error when no session in context', () => {
      const app = new Hono()
      app.get('/', (c) => {
        expect(() => Consumer.getStytchSession(c)).toThrow(
          'No session in context. Was Consumer.authenticateSessionLocal or Consumer.authenticateSessionRemote called?'
        )
        return c.json({ ok: true })
      })

      const req = new Request('http://localhost/')
      app.request(req)
    })
  })

  describe('getStytchUser', () => {
    it('throws error when no user in context', () => {
      const app = new Hono()
      app.get('/', (c) => {
        expect(() => Consumer.getStytchUser(c)).toThrow(
          'No user in context. Was Consumer.authenticateSessionRemote called?'
        )
        return c.json({ ok: true })
      })

      const req = new Request('http://localhost/')
      app.request(req)
    })
  })

  describe('authenticateOAuthToken', () => {
    it('authenticates with bearer token and stores subject and token', async () => {
      const mockClaims = { subject: 'user_oauth_123' }
      oauthMock.introspectTokenLocal.mockResolvedValue(mockClaims)

      const app = new Hono()
      app.use('*', Consumer.authenticateOAuthToken())
      app.get('/', (c) => {
        const oauthData = Consumer.getOAuthData(c)
        return c.json({ subject: oauthData.claims.subject, hasToken: !!oauthData.token })
      })

      const req = new Request('http://localhost/', {
        headers: { Authorization: 'Bearer oauth_token_123' },
      })
      const response = await app.request(req)

      expect(oauthMock.introspectTokenLocal).toHaveBeenCalledWith('oauth_token_123')
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ subject: 'user_oauth_123', hasToken: true })
    })

    it('calls onError callback when no Authorization header', async () => {
      const mockOnError = vi.fn()
      const app = new Hono()
      app.use(
        '*',
        Consumer.authenticateOAuthToken({
          onError: mockOnError,
        })
      )
      app.get('/', (c) => c.json({ ok: true }))

      const req = new Request('http://localhost/')
      const response = await app.request(req)

      expect(mockOnError).toHaveBeenCalled()
      expect(response.status).toBe(401)
    })

    it('calls onError callback when token introspection fails', async () => {
      oauthMock.introspectTokenLocal.mockRejectedValue(new Error('Invalid token'))
      const mockOnError = vi.fn()

      const app = new Hono()
      app.use(
        '*',
        Consumer.authenticateOAuthToken({
          onError: mockOnError,
        })
      )
      app.get('/', (c) => c.json({ ok: true }))

      const req = new Request('http://localhost/', {
        headers: { Authorization: 'Bearer invalid_token' },
      })
      const response = await app.request(req)

      expect(mockOnError).toHaveBeenCalled()
      expect(response.status).toBe(401)
    })

    it('demonstrates using onError to set WWW-Authenticate header', async () => {
      const app = new Hono()
      app.use(
        '*',
        Consumer.authenticateOAuthToken({
          onError: () => {
            const errorResponse = new Response('Unauthorized', {
              status: 401,
              headers: {
                'WWW-Authenticate': 'Bearer realm="api", error="invalid_token"',
              },
            })
            throw new HTTPException(401, { res: errorResponse })
          },
        })
      )
      app.get('/', (c) => c.json({ ok: true }))

      const req = new Request('http://localhost/')
      const response = await app.request(req)

      expect(response.status).toBe(401)
      expect(response.headers.get('WWW-Authenticate')).toBe(
        'Bearer realm="api", error="invalid_token"'
      )
    })

    it('returns 401 when Authorization header does not start with Bearer', async () => {
      const app = new Hono()
      app.use('*', Consumer.authenticateOAuthToken())
      app.get('/', (c) => c.json({ ok: true }))

      const req = new Request('http://localhost/', {
        headers: { Authorization: 'Basic dXNlcjpwYXNz' },
      })
      const response = await app.request(req)

      expect(response.status).toBe(401)
    })
  })

  describe('getOAuthData', () => {
    it('throws error when no OAuth data in context', () => {
      const app = new Hono()
      app.get('/', (c) => {
        expect(() => Consumer.getOAuthData(c)).toThrow(
          'No OAuth data in context. Was Consumer.authenticateOAuthToken called?'
        )
        return c.json({ ok: true })
      })

      const req = new Request('http://localhost/')
      app.request(req)
    })
  })
})

describe('B2B', () => {
  //@ts-expect-error set on globalThis in vi.mock
  const b2bSessionMock = __stytchB2BsessionMock as b2bSessionMock
  //@ts-expect-error set on globalThis in vi.mock
  const b2bIdpMock = __stytchB2BIdpMock as b2bIdpMock
  beforeEach(() => {
    vi.stubEnv('STYTCH_PROJECT_ID', 'project-test-b2b-xxxxx')
    vi.stubEnv('STYTCH_PROJECT_SECRET', 'secret-key-test-b2b-xxxxx')
    vi.stubEnv('STYTCH_DOMAIN', 'https://login.example.com')
  })
  describe('getClient', () => {
    test('Instantiates B2B client from ctx for handlers to use', async () => {
      const app = new Hono()

      const req = new Request('http://localhost/')
      app.get('/', (ctx) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const client = B2B.getClient(ctx) as any
        return ctx.json({
          project_id: client.project_id,
          secret: client.secret,
          custom_base_url: client.custom_base_url,
        })
      })

      const response = await app.request(req)

      expect(response.status).toEqual(200)
      expect(await response.json()).toEqual({
        project_id: 'project-test-b2b-xxxxx',
        secret: 'secret-key-test-b2b-xxxxx',
        custom_base_url: 'https://login.example.com',
      })
    })
  })
  describe('authenticateSessionLocal', () => {
    it('authenticates with default cookie, stores session, and retrieves via getStytchSession', async () => {
      const mockSession = { member_session_id: 'b2b_session_123', organization_id: 'org_123' }
      b2bSessionMock.authenticateJwt.mockResolvedValue({ member_session: mockSession })

      const app = new Hono()
      app.use('*', B2B.authenticateSessionLocal())
      app.get('/', (c) => {
        const session = B2B.getStytchSession(c)
        return c.json({ session_id: session.member_session_id })
      })

      const req = new Request('http://localhost/', {
        headers: { Cookie: 'stytch_session_jwt=b2b_jwt_token_123' },
      })
      const response = await app.request(req)

      expect(b2bSessionMock.authenticateJwt).toHaveBeenCalledWith({
        session_jwt: 'b2b_jwt_token_123',
        max_token_age_seconds: undefined,
      })
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ session_id: 'b2b_session_123' })
    })

    it('uses custom getCredential with custom cookie name', async () => {
      const mockSession = { member_session_id: 'b2b_session_456', organization_id: 'org_456' }
      b2bSessionMock.authenticateJwt.mockResolvedValue({ member_session: mockSession })

      const app = new Hono()
      app.use(
        '*',
        B2B.authenticateSessionLocal({
          getCredential: (c) => ({ session_jwt: getCookie(c, 'custom_b2b_jwt_cookie') ?? '' }),
        })
      )
      app.get('/', (c) => {
        const session = B2B.getStytchSession(c)
        return c.json({ session_id: session.member_session_id })
      })

      const req = new Request('http://localhost/', {
        headers: { Cookie: 'custom_b2b_jwt_cookie=custom_b2b_jwt_token' },
      })
      const response = await app.request(req)

      expect(b2bSessionMock.authenticateJwt).toHaveBeenCalledWith({
        session_jwt: 'custom_b2b_jwt_token',
        max_token_age_seconds: undefined,
      })
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ session_id: 'b2b_session_456' })
    })

    it('passes maxTokenAgeSeconds to authenticateJwt', async () => {
      const mockSession = { member_session_id: 'b2b_session_789', organization_id: 'org_789' }
      b2bSessionMock.authenticateJwt.mockResolvedValue({ member_session: mockSession })

      const app = new Hono()
      app.use('*', B2B.authenticateSessionLocal({ maxTokenAgeSeconds: 3600 }))
      app.get('/', (c) => c.json({ ok: true }))

      const req = new Request('http://localhost/', {
        headers: { Cookie: 'stytch_session_jwt=b2b_jwt_token_789' },
      })
      await app.request(req)

      expect(b2bSessionMock.authenticateJwt).toHaveBeenCalledWith({
        session_jwt: 'b2b_jwt_token_789',
        max_token_age_seconds: 3600,
      })
    })
  })

  describe('authenticateSessionRemote', () => {
    it('authenticates with default cookie, stores session and member, and retrieves via getStytchSession/getStytchMember', async () => {
      const mockSession = {
        member_session_id: 'b2b_session_remote_123',
        organization_id: 'org_remote_123',
      }
      const mockMember = { member_id: 'member_remote_123', email_address: 'john@company.com' }
      b2bSessionMock.authenticate.mockResolvedValue({
        member_session: mockSession,
        member: mockMember,
      })

      const app = new Hono()
      app.use('*', B2B.authenticateSessionRemote())
      app.get('/', (c) => {
        const session = B2B.getStytchSession(c)
        const member = B2B.getStytchMember(c)
        return c.json({ session_id: session.member_session_id, member_id: member.member_id })
      })

      const req = new Request('http://localhost/', {
        headers: { Cookie: 'stytch_session_jwt=b2b_jwt_token_remote_123' },
      })
      const response = await app.request(req)

      expect(b2bSessionMock.authenticate).toHaveBeenCalledWith({
        session_jwt: 'b2b_jwt_token_remote_123',
      })
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        session_id: 'b2b_session_remote_123',
        member_id: 'member_remote_123',
      })
    })

    it('uses custom getCredential with session_token', async () => {
      const mockSession = {
        member_session_id: 'b2b_session_token_456',
        organization_id: 'org_token_456',
      }
      const mockMember = { member_id: 'member_token_456', email_address: 'jane@company.com' }
      b2bSessionMock.authenticate.mockResolvedValue({
        member_session: mockSession,
        member: mockMember,
      })

      const app = new Hono()
      app.use(
        '*',
        B2B.authenticateSessionRemote({
          getCredential: (c) => ({ session_token: getCookie(c, 'stytch_b2b_session_token') ?? '' }),
        })
      )
      app.get('/', (c) => {
        const member = B2B.getStytchMember(c)
        return c.json({ member_id: member.member_id })
      })

      const req = new Request('http://localhost/', {
        headers: { Cookie: 'stytch_b2b_session_token=b2b_session_token_value' },
      })
      const response = await app.request(req)

      expect(b2bSessionMock.authenticate).toHaveBeenCalledWith({
        session_token: 'b2b_session_token_value',
      })
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ member_id: 'member_token_456' })
    })
  })

  describe('B2B authenticateSessionLocal onError', () => {
    it('calls onError callback when B2B JWT authentication fails', async () => {
      b2bSessionMock.authenticateJwt.mockRejectedValue(new Error('Invalid B2B JWT'))
      const mockOnError = vi.fn()

      const app = new Hono()
      app.use(
        '*',
        B2B.authenticateSessionLocal({
          onError: mockOnError,
        })
      )
      app.get('/', (c) => c.json({ ok: true }))

      const req = new Request('http://localhost/', {
        headers: { Cookie: 'stytch_session_jwt=invalid_b2b_jwt' },
      })
      const response = await app.request(req)

      expect(mockOnError).toHaveBeenCalled()
      expect(response.status).toBe(401)
    })

    it('uses onError return value for B2B redirect', async () => {
      b2bSessionMock.authenticateJwt.mockRejectedValue(new Error('Invalid B2B JWT'))

      const app = new Hono()
      app.use(
        '*',
        B2B.authenticateSessionLocal({
          onError: (c) => {
            return c.redirect('/b2b/login')
          },
        })
      )
      app.get('/', (c) => c.json({ ok: true }))

      const req = new Request('http://localhost/', {
        headers: { Cookie: 'stytch_session_jwt=invalid_b2b_jwt' },
      })
      const response = await app.request(req)

      expect(response.status).toBe(302)
      expect(response.headers.get('Location')).toBe('/b2b/login')
    })
  })

  describe('B2B authenticateSessionRemote onError', () => {
    it('calls onError callback when B2B remote authentication fails', async () => {
      b2bSessionMock.authenticate.mockRejectedValue(new Error('B2B Session expired'))
      const mockOnError = vi.fn()

      const app = new Hono()
      app.use(
        '*',
        B2B.authenticateSessionRemote({
          onError: mockOnError,
        })
      )
      app.get('/', (c) => c.json({ ok: true }))

      const req = new Request('http://localhost/', {
        headers: { Cookie: 'stytch_session_jwt=expired_b2b_jwt' },
      })
      const response = await app.request(req)

      expect(mockOnError).toHaveBeenCalled()
      expect(response.status).toBe(401)
    })

    it('demonstrates B2B onError with WWW-Authenticate header', async () => {
      b2bSessionMock.authenticate.mockRejectedValue(new Error('B2B Session expired'))

      const app = new Hono()
      app.use(
        '*',
        B2B.authenticateSessionRemote({
          onError: () => {
            const errorResponse = new Response('B2B Session expired', {
              status: 401,
              headers: {
                'WWW-Authenticate': 'Bearer realm="b2b-app"',
              },
            })
            throw new HTTPException(401, { res: errorResponse })
          },
        })
      )
      app.get('/', (c) => c.json({ ok: true }))

      const req = new Request('http://localhost/', {
        headers: { Cookie: 'stytch_session_jwt=expired_b2b_jwt' },
      })
      const response = await app.request(req)

      expect(response.status).toBe(401)
      expect(response.headers.get('WWW-Authenticate')).toBe('Bearer realm="b2b-app"')
    })
  })

  describe('B2B Organization Support', () => {
    it('stores organization in context during remote authentication', async () => {
      const mockSession = {
        member_session_id: 'b2b_session_org_123',
        organization_id: 'org_org_123',
      }
      const mockMember = { member_id: 'member_org_123', email_address: 'john@company.com' }
      const mockOrganization = { organization_id: 'org_org_123', organization_name: 'Test Org' }
      b2bSessionMock.authenticate.mockResolvedValue({
        member_session: mockSession,
        member: mockMember,
        organization: mockOrganization,
      })

      const app = new Hono()
      app.use('*', B2B.authenticateSessionRemote())
      app.get('/', (c) => {
        const organization = B2B.getStytchOrganization(c)
        return c.json({ organization_name: organization.organization_name })
      })

      const req = new Request('http://localhost/', {
        headers: { Cookie: 'stytch_session_jwt=b2b_jwt_org_token' },
      })
      const response = await app.request(req)

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ organization_name: 'Test Org' })
    })
  })

  describe('getStytchOrganization', () => {
    it('throws error when no organization in context', () => {
      const app = new Hono()
      app.get('/', (c) => {
        expect(() => B2B.getStytchOrganization(c)).toThrow(
          'No organization in context. Was B2B.authenticateSessionRemote called?'
        )
        return c.json({ ok: true })
      })

      const req = new Request('http://localhost/')
      app.request(req)
    })
  })

  describe('getStytchSession', () => {
    it('throws error when no session in context', () => {
      const app = new Hono()
      app.get('/', (c) => {
        expect(() => B2B.getStytchSession(c)).toThrow(
          'No session in context. Was B2B.authenticateSessionLocal or B2B.authenticateSessionRemote called?'
        )
        return c.json({ ok: true })
      })

      const req = new Request('http://localhost/')
      app.request(req)
    })
  })

  describe('getStytchMember', () => {
    it('throws error when no member in context', () => {
      const app = new Hono()
      app.get('/', (c) => {
        expect(() => B2B.getStytchMember(c)).toThrow(
          'No member in context. Was B2B.authenticateSessionRemote called?'
        )
        return c.json({ ok: true })
      })

      const req = new Request('http://localhost/')
      app.request(req)
    })
  })

  describe('authenticateOAuthToken', () => {
    it('authenticates with bearer token and stores subject and token', async () => {
      const mockClaims = { subject: 'b2b_user_oauth_123' }
      b2bIdpMock.introspectTokenLocal.mockResolvedValue(mockClaims)

      const app = new Hono()
      app.use('*', B2B.authenticateOAuthToken())
      app.get('/', (c) => {
        const oauthData = B2B.getOAuthData(c)
        return c.json({ subject: oauthData.claims.subject, hasToken: !!oauthData.token })
      })

      const req = new Request('http://localhost/', {
        headers: { Authorization: 'Bearer b2b_oauth_token_123' },
      })
      const response = await app.request(req)

      expect(b2bIdpMock.introspectTokenLocal).toHaveBeenCalledWith('b2b_oauth_token_123')
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ subject: 'b2b_user_oauth_123', hasToken: true })
    })

    it('calls onError callback when no Authorization header', async () => {
      const mockOnError = vi.fn()
      const app = new Hono()
      app.use(
        '*',
        B2B.authenticateOAuthToken({
          onError: mockOnError,
        })
      )
      app.get('/', (c) => c.json({ ok: true }))

      const req = new Request('http://localhost/')
      const response = await app.request(req)

      expect(mockOnError).toHaveBeenCalled()
      expect(response.status).toBe(401)
    })

    it('calls onError callback when token introspection fails', async () => {
      b2bIdpMock.introspectTokenLocal.mockRejectedValue(new Error('Invalid B2B token'))
      const mockOnError = vi.fn()

      const app = new Hono()
      app.use(
        '*',
        B2B.authenticateOAuthToken({
          onError: mockOnError,
        })
      )
      app.get('/', (c) => c.json({ ok: true }))

      const req = new Request('http://localhost/', {
        headers: { Authorization: 'Bearer invalid_b2b_token' },
      })
      const response = await app.request(req)

      expect(mockOnError).toHaveBeenCalled()
      expect(response.status).toBe(401)
    })

    it('demonstrates using onError to set WWW-Authenticate header for B2B', async () => {
      const app = new Hono()
      app.use(
        '*',
        B2B.authenticateOAuthToken({
          onError: () => {
            const errorResponse = new Response('Unauthorized', {
              status: 401,
              headers: {
                'WWW-Authenticate': 'Bearer realm="b2b-api", error="invalid_token"',
              },
            })
            throw new HTTPException(401, { res: errorResponse })
          },
        })
      )
      app.get('/', (c) => c.json({ ok: true }))

      const req = new Request('http://localhost/')
      const response = await app.request(req)

      expect(response.status).toBe(401)
      expect(response.headers.get('WWW-Authenticate')).toBe(
        'Bearer realm="b2b-api", error="invalid_token"'
      )
    })

    it('returns 401 when Authorization header does not start with Bearer', async () => {
      const app = new Hono()
      app.use('*', B2B.authenticateOAuthToken())
      app.get('/', (c) => c.json({ ok: true }))

      const req = new Request('http://localhost/', {
        headers: { Authorization: 'Basic dXNlcjpwYXNz' },
      })
      const response = await app.request(req)

      expect(response.status).toBe(401)
    })
  })

  describe('getOAuthData', () => {
    it('throws error when no B2B OAuth data in context', () => {
      const app = new Hono()
      app.get('/', (c) => {
        expect(() => B2B.getOAuthData(c)).toThrow(
          'No B2B OAuth data in context. Was B2B.authenticateOAuthToken called?'
        )
        return c.json({ ok: true })
      })

      const req = new Request('http://localhost/')
      app.request(req)
    })
  })
})
