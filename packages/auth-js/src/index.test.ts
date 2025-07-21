import { skipCSRFCheck } from '@auth/core'
import type { Adapter } from '@auth/core/adapters'
import Credentials from '@auth/core/providers/credentials'
import { Hono } from 'hono'
import { validator } from 'hono/validator'
import { describe, expect, it, vi } from 'vitest'
import type { AuthConfig } from '.'
import { authHandler, verifyAuth, initAuthConfig, reqWithEnvUrl } from '.'

describe('Config', () => {
  it('Should return 500 if AUTH_SECRET is missing', async () => {
    globalThis.process.env = { AUTH_SECRET: '' }
    const app = new Hono()

    app.use(
      '/*',
      initAuthConfig(() => {
        return {
          providers: [],
        }
      })
    )
    app.use('/api/auth/*', authHandler())
    const req = new Request('http://localhost/api/auth/signin')
    const res = await app.request(req)
    expect(res.status).toBe(500)
    expect(await res.text()).toBe('Missing AUTH_SECRET')
  })

  it('Should return 200 auth initial config is correct', async () => {
    globalThis.process.env = { AUTH_SECRET: 'secret' }
    const app = new Hono()

    app.use(
      '/*',
      initAuthConfig(() => {
        return {
          basePath: '/api/auth',
          providers: [],
        }
      })
    )

    app.use('/api/auth/*', authHandler())
    const req = new Request('http://localhost/api/auth/signin')
    const res = await app.request(req)
    expect(res.status).toBe(200)
  })

  it('Should allow async ConfigHandler', async () => {
    globalThis.process.env = { AUTH_SECRET: 'secret' }
    const app = new Hono()

    app.use(
      '/*',
      initAuthConfig(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1))
        return {
          basePath: '/api/auth',
          providers: [],
        }
      })
    )

    app.use('/api/auth/*', authHandler())
    const req = new Request('http://localhost/api/auth/signin')
    const res = await app.request(req)
    expect(res.status).toBe(200)
  })

  it('Should return 401 is if auth cookie is invalid or missing', async () => {
    const app = new Hono()

    app.use('/*', (c, next) => {
      c.env = { AUTH_SECRET: 'secret' }
      return next()
    })

    app.use(
      '/*',
      initAuthConfig(() => {
        return {
          providers: [],
        }
      })
    )

    app.use('/api/*', verifyAuth())

    app.use('/api/auth/*', authHandler())

    app.get('/api/protected', (c) => c.text('protected'))
    const req = new Request('http://localhost/api/protected')
    const res = await app.request(req)
    expect(res.status).toBe(401)
  })
})

describe('reqWithEnvUrl()', async () => {
  const req = new Request('http://request-base/request-path')
  const newReq = await reqWithEnvUrl(req, 'https://auth-url-base/auth-url-path')
  it('Should rewrite the base path', () => {
    expect(newReq.url.toString()).toBe('https://auth-url-base/request-path')
  })

  const mockAdapter: Adapter = {
    createVerificationToken: vi.fn(),
    useVerificationToken: vi.fn(),
    getUserByEmail: vi.fn(),
    createUser: vi.fn(),
    getUser: vi.fn(),
    getUserByAccount: vi.fn(),
    updateUser: vi.fn(),
    linkAccount: vi.fn(),
    createSession: vi.fn(),
    getSessionAndUser: vi.fn(),
    updateSession: vi.fn(),
    deleteSession: vi.fn(),
  }

  globalThis.process.env = {
    AUTH_SECRET: 'secret',
  }

  const user = { email: 'hono@hono.hono', name: 'Hono' }

  const credentials = Credentials({
    credentials: {
      password: {},
    },
    authorize: (credentials) => {
      if (credentials.password === 'password') {
        return user
      }
      return null
    },
  })

  function getAuthConfig(): AuthConfig {
    return {
      secret: 'secret',
      providers: [credentials],
      adapter: mockAdapter,
      basePath: '/api/auth',
      callbacks: {
        jwt: ({ token, user }) => {
          if (user) {
            token.id = user.id
          }
          return token
        },
      },
      session: {
        strategy: 'jwt',
      },
    }
  }

  let cookie = ['']

  it('Should be able to instantiate new Request after passing through validator', async () => {
    const app = new Hono()

    app.use('*', initAuthConfig(getAuthConfig))
    app.use(
      '/api/auth/*',
      validator('form', (value, _) => {
        const csrfToken = value['csrfToken']
        return {
          csrfToken,
        }
      }),
      authHandler()
    )

    let csrfRes = await app.request('http://localhost/api/auth/csrf', {
      method: 'GET',
    })
    let { csrfToken } = await csrfRes.json()

    cookie = csrfRes.headers.getSetCookie()

    let headers = new Headers()
    headers.append('cookie', cookie[0])

    const signInRes = await app.request('http://localhost/api/auth/callback/credentials', {
      method: 'POST',
      headers,
      body: new URLSearchParams({
        csrfToken,
        password: 'password',
      }),
    })
    expect(signInRes.status).toBe(302)
    expect(signInRes.headers.get('location')).toBe('http://localhost')

    cookie = signInRes.headers.getSetCookie()

    const sessionCookie = cookie[1]

    headers = new Headers()
    headers.append('cookie', cookie[1])
    headers.append('Content-Type', 'application/json')

    csrfRes = await app.request('http://localhost/api/auth/csrf', {
      method: 'GET',
    })
    ;({ csrfToken } = await csrfRes.json())

    cookie = csrfRes.headers.getSetCookie()

    headers = new Headers()
    headers.append('cookie', cookie[0])
    headers.append('cookie', sessionCookie)

    const req = new Request('http://localhost/api/auth/signout', {
      method: 'POST',
      body: new URLSearchParams({
        csrfToken,
        password: 'password',
      }),
      headers,
    })
    const res = await app.request(req)
    expect(res.status).toBe(302)
  })
})

describe('Credentials Provider', () => {
  const mockAdapter: Adapter = {
    createVerificationToken: vi.fn(),
    useVerificationToken: vi.fn(),
    getUserByEmail: vi.fn(),
    createUser: vi.fn(),
    getUser: vi.fn(),
    getUserByAccount: vi.fn(),
    updateUser: vi.fn(),
    linkAccount: vi.fn(),
    createSession: vi.fn(),
    getSessionAndUser: vi.fn(),
    updateSession: vi.fn(),
    deleteSession: vi.fn(),
  }

  globalThis.process.env = {
    AUTH_SECRET: 'secret',
  }

  const user = { email: 'hono@hono.hono', name: 'Hono' }

  const app = new Hono()

  app.use('*', initAuthConfig(getAuthConfig))

  app.use('/api/auth/*', authHandler())

  app.use('/api/*', verifyAuth())

  app.get('/api/protected', (c) => {
    const auth = c.get('authUser')
    return c.json(auth)
  })

  app.post('/api/create', async (c) => {
    const data = await c.req.json()
    return c.json({ data })
  })

  const credentials = Credentials({
    credentials: {
      password: {},
    },
    authorize: (credentials) => {
      if (credentials.password === 'password') {
        return user
      }
      return null
    },
  })

  function getAuthConfig(): AuthConfig {
    return {
      secret: 'secret',
      providers: [credentials],
      adapter: mockAdapter,
      basePath: '/api/auth',
      skipCSRFCheck,
      callbacks: {
        jwt: ({ token, user }) => {
          if (user) {
            token.id = user.id
          }
          return token
        },
      },
      session: {
        strategy: 'jwt',
      },
    }
  }

  let cookie = ['']

  it('Should not authorize and return 302 - /api/auth/callback/credentials', async () => {
    const res = await app.request('/api/auth/callback/credentials', {
      method: 'POST',
    })
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe(
      'http://localhost/api/auth/signin?error=CredentialsSignin&code=credentials'
    )
  })

  it('Should authorize and return 302 - /api/auth/callback/credentials', async () => {
    const res = await app.request('http://localhost/api/auth/callback/credentials', {
      method: 'POST',
      body: new URLSearchParams({
        password: 'password',
      }),
    })
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('http://localhost')
    cookie = res.headers.getSetCookie()
  })

  it('Should authorize and return 200 - /api/protected', async () => {
    const headers = new Headers()
    headers.append('cookie', cookie[1])
    const res = await app.request('http://localhost/api/protected', {
      headers,
    })
    expect(res.status).toBe(200)
    const obj = (await res.json()) as {
      token: {
        name: string
        email: string
      }
    }
    expect(obj.token.name).toBe(user.name)
    expect(obj.token.email).toBe(user.email)
  })

  it('Should authorize and return 200 - /api/create', async () => {
    const data = { name: 'Hono' }

    const headers = new Headers()
    headers.append('cookie', cookie[1])
    headers.append('Content-Type', 'application/json')
    const res = await app.request('http://localhost/api/create', {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    })
    expect(res.status).toBe(200)
    const obj = (await res.json()) as {
      data: {
        name: string
      }
    }
    expect(obj.data.name).toBe(data.name)
  })

  it('Should respect x-forwarded-proto and x-forwarded-host', async () => {
    const headers = new Headers()
    headers.append('x-forwarded-proto', 'https')
    headers.append('x-forwarded-host', 'example.com')
    const res = await app.request('http://localhost/api/auth/signin', {
      headers,
    })
    const html = await res.text()
    expect(html).toContain('action="https://example.com/api/auth/callback/credentials"')
  })
})
