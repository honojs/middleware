import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import { superTokensMiddleware, verifySession, getSession } from './index'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockGetSession = vi.fn()
const mockSessionError = {
  isErrorFromSuperTokens: (err: unknown) =>
    typeof err === 'object' && err !== null && '__isSupertokensError' in err,
  TRY_REFRESH_TOKEN: 'TRY_REFRESH_TOKEN',
  UNAUTHORISED: 'UNAUTHORISED',
}

vi.mock('supertokens-node/recipe/session', () => ({
  default: {
    getSession: (...args: unknown[]) => mockGetSession(...args),
    Error: mockSessionError,
  },
}))

// Minimal CollectingResponse / PreParsedRequest mocks
vi.mock('supertokens-node/framework/custom', () => {
  class FakePreParsedRequest {
    method: string
    url: string
    query: Record<string, string>
    headers: Record<string, string>
    cookies: Record<string, string>
    getFormBody: () => Promise<FormData>
    getJSONBody: () => Promise<unknown>
    constructor(opts: {
      method: string
      url: string
      query: Record<string, string>
      headers: Record<string, string>
      cookies: Record<string, string>
      getFormBody: () => Promise<FormData>
      getJSONBody: () => Promise<unknown>
    }) {
      this.method = opts.method
      this.url = opts.url
      this.query = opts.query
      this.headers = opts.headers
      this.cookies = opts.cookies
      this.getFormBody = opts.getFormBody
      this.getJSONBody = opts.getJSONBody
    }
  }

  class FakeCollectingResponse {
    statusCode = 200
    body = ''
    headers = new Map<string, string[]>()
    cookies: string[] = []
  }

  const middleware = vi.fn(() => async (_req: unknown, _res: unknown, _next: () => Promise<void>) => {
    // Don't call _next — the real implementation passes a noop
    return { error: undefined, handled: false }
  })

  const errorHandler = vi.fn(() => async (_err: unknown, _req: unknown, res: FakeCollectingResponse) => {
    res.statusCode = 500
    res.body = JSON.stringify({ message: 'error' })
  })

  return {
    PreParsedRequest: FakePreParsedRequest,
    CollectingResponse: FakeCollectingResponse,
    middleware,
    errorHandler,
  }
})

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeRequest(path = '/', method = 'GET', headers: Record<string, string> = {}) {
  return new Request(`http://localhost${path}`, { method, headers })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('superTokensMiddleware()', () => {
  it('passes unrecognised routes to the next handler', async () => {
    const app = new Hono()
    app.use('/auth/*', superTokensMiddleware())
    app.get('/auth/unknown', (c) => c.json({ ok: true }))

    const res = await app.request(makeRequest('/auth/unknown'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ ok: true })
  })

  it('returns 200 for public routes that do not go through auth middleware', async () => {
    const app = new Hono()
    app.use('/auth/*', superTokensMiddleware())
    app.get('/', (c) => c.text('hello'))

    const res = await app.request(makeRequest('/'))
    expect(res.status).toBe(200)
  })
})

describe('verifySession()', () => {
  beforeEach(() => {
    mockGetSession.mockReset()
  })

  it('stores session on c.var and calls next when session is valid', async () => {
    const fakeSession = { getUserId: () => 'user-123' }
    mockGetSession.mockResolvedValue(fakeSession)

    const app = new Hono()
    app.get('/me', verifySession(), (c) => {
      const session = c.get('session')
      return c.json({ userId: session.getUserId() })
    })

    const res = await app.request(makeRequest('/me'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ userId: 'user-123' })
  })

  it('returns 401 when there is no session and sessionRequired defaults to true', async () => {
    const err = Object.assign(new Error('no session'), {
      __isSupertokensError: true,
      type: 'UNAUTHORISED',
    })
    mockGetSession.mockRejectedValue(err)

    const app = new Hono()
    app.get('/protected', verifySession(), (c) => c.json({ ok: true }))

    const res = await app.request(makeRequest('/protected'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.message).toBe('Unauthorized')
  })

  it('returns 401 with refresh message on TRY_REFRESH_TOKEN error', async () => {
    const err = Object.assign(new Error('refresh'), {
      __isSupertokensError: true,
      type: 'TRY_REFRESH_TOKEN',
    })
    mockGetSession.mockRejectedValue(err)

    const app = new Hono()
    app.get('/protected', verifySession(), (c) => c.json({ ok: true }))

    const res = await app.request(makeRequest('/protected'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.message).toContain('Session expired')
  })

  it('allows an optional session when sessionRequired is false', async () => {
    mockGetSession.mockResolvedValue(undefined)

    const app = new Hono()
    app.get('/feed', verifySession({ sessionRequired: false }), (c) => {
      const session = c.get('session')
      return c.json({ loggedIn: session !== undefined })
    })

    const res = await app.request(makeRequest('/feed'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ loggedIn: false })
  })

  it('rethrows non-SuperTokens errors', async () => {
    mockGetSession.mockRejectedValue(new Error('database exploded'))

    const app = new Hono()
    app.get('/boom', verifySession(), (c) => c.json({ ok: true }))
    app.onError((err, c) => c.json({ message: err.message }, 500))

    const res = await app.request(makeRequest('/boom'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.message).toBe('database exploded')
  })
})

describe('getSession()', () => {
  it('returns the session stored by verifySession()', async () => {
    const fakeSession = { getUserId: () => 'user-abc' }
    mockGetSession.mockResolvedValue(fakeSession)

    const app = new Hono()
    app.get('/me', verifySession(), (c) => {
      const session = getSession(c)
      return c.json({ userId: session.getUserId() })
    })

    const res = await app.request(makeRequest('/me'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ userId: 'user-abc' })
  })

  it('throws if called without verifySession() in the chain', async () => {
    const app = new Hono()
    app.get('/bad', (c) => {
      getSession(c) // no verifySession middleware
      return c.json({ ok: true })
    })
    app.onError((err, c) => c.json({ message: err.message }, 500))

    const res = await app.request(makeRequest('/bad'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.message).toContain('No session found in context')
  })
})
