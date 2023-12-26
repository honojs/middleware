import {webcrypto} from 'node:crypto'
import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { authHandler, verifyAuth,initAuthConfig} from '../src'


// @ts-expect-error - global crypto
//needed for node 18 and below but should work in node 20 and above
global.crypto =  webcrypto

describe('Auth.js Adapter Middleware', () => {
  it('Should return 500 if AUTH_SECRET is missing', async () => {
    const app = new Hono()

    app.use('/*', (c, next) => {
      c.env = {}
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

    app.use('/api/auth/*', authHandler())
    const req = new Request('http://localhost/api/auth/error')
    const res = await app.request(req)
    expect(res.status).toBe(500)
    expect(await res.text()).toBe('Missing AUTH_SECRET')
  })

  it('Should return 200 auth  initial config is correct', async () => {
    const app = new Hono()

    app.use('/*', (c, next) => {
      c.env = {'AUTH_SECRET':'secret'}
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

    app.use('/api/auth/*', authHandler())
    const req = new Request('http://localhost/api/auth/error')
    const res = await app.request(req)
    expect(res.status).toBe(200)
  })

  it('Should return 401 is if auth cookie is invalid or missing', async () => {
    const app = new Hono()

    app.use('/*', (c, next) => {
      c.env = {'AUTH_SECRET':'secret'}
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

    app.get('/api/protected', (c)=> c.text('protected'))
    const req = new Request('http://localhost/api/protected')
    const res = await app.request(req)
    expect(res.status).toBe(401)
  })
})
