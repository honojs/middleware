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

describe('withClerkMiddleware(options)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.restoreAllMocks()
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
        'User-Agent': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
      },
    })

    const response = await app.request(req, {}, EnvVariables)

    expect(response.status).toEqual(200)
    expect(await response.json()).toEqual({ auth: 'mockedAuth' })
    expect(authenticateRequestMock).toBeCalledWith(
      expect.objectContaining({
        secretKey: 'TEST_API_KEY',
        publishableKey: 'TEST_API_KEY',
        request: expect.any(Request),
      }),
    )
  })
})
