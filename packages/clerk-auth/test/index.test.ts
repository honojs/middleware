/* eslint-disable @typescript-eslint/no-explicit-any */
import { Hono } from 'hono'
import { clerkMiddleware, getAuth } from '../src'

const EnvVariables = {
  CLERK_SECRET_KEY: 'TEST_API_KEY',
  CLERK_PUBLISHABLE_KEY: 'TEST_API_KEY',
}

const authenticateRequestMock = jest.fn()

jest.mock('@clerk/backend', () => {
  return {
    ...jest.requireActual('@clerk/backend'),
    createClerkClient: () => {
      return {
        authenticateRequest: (...args: any) => authenticateRequestMock(...args),
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
    authenticateRequestMock.mockResolvedValueOnce({
      headers: new Headers(),
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
    expect(authenticateRequestMock).toHaveBeenCalledWith(
      expect.any(Request),
      expect.objectContaining({
        secretKey: EnvVariables.CLERK_SECRET_KEY,
      })
    )
  })

  test('handles signin with cookie', async () => {
    authenticateRequestMock.mockResolvedValueOnce({
      headers: new Headers(),
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
    expect(authenticateRequestMock).toHaveBeenCalledWith(
      expect.any(Request),
      expect.objectContaining({
        secretKey: EnvVariables.CLERK_SECRET_KEY,
      })
    )
  })

  test('handles handshake case by redirecting the request to fapi', async () => {
    authenticateRequestMock.mockResolvedValueOnce({
      status: 'handshake',
      reason: 'auth-reason',
      message: 'auth-message',
      headers: new Headers({
        location: 'https://fapi.example.com/v1/clients/handshake',
        'x-clerk-auth-message': 'auth-message',
        'x-clerk-auth-reason': 'auth-reason',
        'x-clerk-auth-status': 'handshake',
      }),
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

    expect(response.status).toEqual(307)
    expect(Object.fromEntries(response.headers.entries())).toMatchObject({
      location: 'https://fapi.example.com/v1/clients/handshake',
      'x-clerk-auth-status': 'handshake',
      'x-clerk-auth-reason': 'auth-reason',
      'x-clerk-auth-message': 'auth-message',
    })
  })

  test('handles signout case by populating the req.auth', async () => {
    authenticateRequestMock.mockResolvedValueOnce({
      headers: new Headers(),
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
    expect(authenticateRequestMock).toHaveBeenCalledWith(
      expect.any(Request),
      expect.objectContaining({
        secretKey: EnvVariables.CLERK_SECRET_KEY,
      })
    )
  })
})
