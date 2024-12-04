/* eslint-disable @typescript-eslint/no-explicit-any */
import { Hono } from 'hono'
import { checkToken, getSupabaseAuth } from '../src'

const EnvVariables = {
  SUPABASE_JWT_SECRET: 'TEST_API_KEY',
}

const authenticateRequestMock = jest.fn()

jest.mock('@supabase/supabase-js', () => {
  return {
    ...jest.requireActual('@supabase/supabase-js'),
    createClient: () => {
      return {
        authenticateRequest: (...args: any) => authenticateRequestMock(...args),
      }
    },
  }
})

describe('supabashMiddleware()', () => {
  beforeEach(() => {
    process.env.SUPABASE_JWT_SECRET = EnvVariables.SUPABASE_JWT_SECRET
    jest.clearAllMocks()
    jest.restoreAllMocks()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // handles req without Authorization in headers
  test('handles req without Authorization in headers', async () => {
    authenticateRequestMock.mockResolvedValueOnce({
      headers: new Headers(),
    })
    const app = new Hono()
    app.use('*', checkToken())

    const response = await app.request(new Request('http://localhost/'))

    expect(response.status).toEqual(401)
    expect(await response.json()).toEqual({ message: 'token is required' })
  })

  // handles invalid Authorization in headers
  test('handles invalid Authorization in headers', async () => {
    authenticateRequestMock.mockResolvedValueOnce({
      headers: new Headers(),
    })
    const app = new Hono()
    app.use('*', checkToken())

    const req = new Request('http://localhost/', {
      headers: {
        Authorization: 'Bearer deadbeef',
      },
    })
    const response = await app.request(req)

    expect(response.status).toEqual(401)
    expect(await response.json()).toEqual({ message: 'jwt is invalid' })
  })

  // handles valid Authorization in headers
  test('handles valid Authorization in headers', async () => {
    const header =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.qqsQYQ1p6_Ou4kpXyDf-VbYKTBhYooZUaU7Yj2EFnzA'
    authenticateRequestMock.mockResolvedValueOnce({
      headers: new Headers(),
    })
    const app = new Hono()
    app.use('*', checkToken())
    app.get('/', (ctx) => {
      const auth = getSupabaseAuth(ctx)
      return ctx.json({ auth })
    })
    const req = new Request('http://localhost/', {
      headers: {
        Authorization: `Bearer ${header}`,
      },
    })
    const response = await app.request(req)
    expect(response.status).toEqual(200)
    expect(await response.json()).toEqual({
      auth: {
        auth: {
          sub: '1234567890',
          name: 'John Doe',
          iat: 1516239022,
        },
        token: header,
      },
    })
  })

  // handles add type of user_metadata in payload
  test('getSupabaseAuth', async () => {
    const header =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.qqsQYQ1p6_Ou4kpXyDf-VbYKTBhYooZUaU7Yj2EFnzA'
    authenticateRequestMock.mockResolvedValueOnce({
      headers: new Headers(),
    })
    const app = new Hono()
    app.use('*', checkToken())
    app.get('/', (ctx) => {
      const auth = getSupabaseAuth(ctx)
      return ctx.json({ auth })
    })
    const req = new Request('http://localhost/', {
      headers: {
        Authorization: `Bearer ${header}`,
      },
    })
    const response = await app.request(req)
    expect(response.status).toEqual(200)
    expect(await response.json()).toEqual({
      auth: {
        auth: {
          sub: '1234567890',
          name: 'John Doe',
          iat: 1516239022,
        },
        token: header,
      },
    })
  })
})
