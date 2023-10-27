/* eslint-disable @typescript-eslint/no-explicit-any */
import { Hono } from 'hono'
import { clerkMiddleware, getAuth } from '../src'

const EnvVariables = {
  CLERK_SECRET_KEY: 'TEST_API_KEY',
  CLERK_PUBLISHABLE_KEY: 'TEST_API_KEY',
}

const authenticateRequestMock = jest.fn()
const localInterstitialMock = jest.fn()

jest.mock('@clerk/backend', () => {
  return {
    ...jest.requireActual('@clerk/backend'),
    Clerk: () => {
      return {
        authenticateRequest: (...args: any) => authenticateRequestMock(...args),
        localInterstitial: (...args: any) => localInterstitialMock(...args),
      }
    },
  }
})

// Test are based on Clerk's test suite for Fastify plugin - https://github.com/clerkinc/javascript/blob/main/packages/fastify/src/withClerkMiddleware.test.ts
describe('clerkMiddleware()', () => {
  beforeEach(() => {
    process.env.CLERK_SECRET_KEY = EnvVariables.CLERK_SECRET_KEY
    process.env.CLERK_PUBLISHABLE_KEY = EnvVariables.CLERK_PUBLISHABLE_KEY
    jest.clearAllMocks()
    jest.restoreAllMocks()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  test('handles signin with Authorization Bearer', async () => {
    authenticateRequestMock.mockResolvedValue({
      isUnknown: false,
      isInterstitial: false,
      isSignedIn: true,
      toAuth: () => 'mockedAuth',
    })
    const app = new Hono()
    app.use('*', clerkMiddleware())

    app.get('/', (ctx) => {
      const auth = getAuth(ctx)
      return ctx.json({ auth })
    })

    const req = new Request('http://localhost/', {
      headers: {
        Authorization: 'Bearer deadbeef',
        Origin: 'http://origin.com',
        Host: 'host.com',
        'X-Forwarded-Port': '1234',
        'X-Forwarded-Host': 'forwarded-host.com',
        Referer: 'referer.com',
        'User-Agent':
          'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
      },
    })

    const response = await app.request(req)

    expect(response.status).toEqual(200)
    expect(await response.json()).toEqual({ auth: 'mockedAuth' })
    expect(authenticateRequestMock).toBeCalledWith(
      expect.objectContaining({
        secretKey: EnvVariables.CLERK_SECRET_KEY,
        publishableKey: EnvVariables.CLERK_PUBLISHABLE_KEY,
        request: expect.any(Request),
      })
    )
  })

  test('handles signin with cookie', async () => {
    authenticateRequestMock.mockResolvedValue({
      isUnknown: false,
      isInterstitial: false,
      isSignedIn: true,
      toAuth: () => 'mockedAuth',
    })
    const app = new Hono()
    app.use('*', clerkMiddleware())

    app.get('/', (ctx) => {
      const auth = getAuth(ctx)
      return ctx.json({ auth })
    })

    const req = new Request('http://localhost/', {
      headers: {
        cookie: '_gcl_au=value1; ko_id=value2; __session=deadbeef; __client_uat=1675692233',
        Origin: 'http://origin.com',
        Host: 'host.com',
        'X-Forwarded-Port': '1234',
        'X-Forwarded-Host': 'forwarded-host.com',
        Referer: 'referer.com',
        'User-Agent':
          'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
      },
    })

    const response = await app.request(req)

    expect(response.status).toEqual(200)
    expect(await response.json()).toEqual({ auth: 'mockedAuth' })
    expect(authenticateRequestMock).toBeCalledWith(
      expect.objectContaining({
        secretKey: EnvVariables.CLERK_SECRET_KEY,
        publishableKey: EnvVariables.CLERK_PUBLISHABLE_KEY,
        request: expect.any(Request),
      })
    )
  })

  test('handles unknown case by terminating the request with empty response and 401 http code', async () => {
    authenticateRequestMock.mockResolvedValue({
      isUnknown: true,
      isInterstitial: false,
      isSignedIn: false,
      reason: 'auth-reason',
      message: 'auth-message',
      toAuth: () => 'mockedAuth',
    })
    const app = new Hono()
    app.use('*', clerkMiddleware())

    app.get('/', (ctx) => {
      const auth = getAuth(ctx)
      return ctx.json({ auth })
    })

    const req = new Request('http://localhost/', {
      headers: {
        cookie: '_gcl_au=value1; ko_id=value2; __session=deadbeef; __client_uat=1675692233',
      },
    })

    const response = await app.request(req)

    expect(response.status).toEqual(401)
    expect(response.headers.get('x-clerk-auth-reason')).toEqual('auth-reason')
    expect(response.headers.get('x-clerk-auth-message')).toEqual('auth-message')
    expect(await response.text()).toEqual('')
  })

  test('handles interstitial case by terminating the request with interstitial html page and 401 http code', async () => {
    authenticateRequestMock.mockResolvedValue({
      isUnknown: false,
      isInterstitial: true,
      isSignedIn: false,
      reason: 'auth-reason',
      message: 'auth-message',
      toAuth: () => 'mockedAuth',
    })
    localInterstitialMock.mockReturnValue('<html><body>Interstitial</body></html>')
    const app = new Hono()
    app.use('*', clerkMiddleware())

    app.get('/', (ctx) => {
      const auth = getAuth(ctx)
      return ctx.json({ auth })
    })

    const req = new Request('http://localhost/', {
      headers: {
        cookie: '_gcl_au=value1; ko_id=value2; __session=deadbeef; __client_uat=1675692233',
      },
    })

    const response = await app.request(req)

    expect(response.status).toEqual(401)
    expect(response.headers.get('content-type')).toMatch('text/html')
    expect(response.headers.get('x-clerk-auth-reason')).toEqual('auth-reason')
    expect(response.headers.get('x-clerk-auth-message')).toEqual('auth-message')
    expect(await response.text()).toEqual('<html><body>Interstitial</body></html>')
  })

  test('handles signout case by populating the req.auth', async () => {
    authenticateRequestMock.mockResolvedValue({
      isUnknown: false,
      isInterstitial: false,
      isSignedIn: false,
      toAuth: () => 'mockedAuth',
    })
    const app = new Hono()
    app.use('*', clerkMiddleware())

    app.get('/', (ctx) => {
      const auth = getAuth(ctx)
      return ctx.json({ auth })
    })

    const req = new Request('http://localhost/', {
      headers: {
        Authorization: 'Bearer deadbeef',
      },
    })

    const response = await app.request(req)

    expect(response.status).toEqual(200)
    expect(await response.json()).toEqual({ auth: 'mockedAuth' })
    expect(authenticateRequestMock).toBeCalledWith(
      expect.objectContaining({
        secretKey: EnvVariables.CLERK_SECRET_KEY,
        publishableKey: EnvVariables.CLERK_PUBLISHABLE_KEY,
        request: expect.any(Request),
      })
    )
  })
})
