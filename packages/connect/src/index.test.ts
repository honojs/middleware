import { Hono } from 'hono'
import { poweredBy } from 'hono/powered-by'
import { connect } from '../src'
import helmet from 'helmet'

describe('Connect middleware', () => {
  const app = new Hono()

  app.use('/connect/*', connect(helmet()))
  app.get('/connect/foo', (c) => c.text('foo'))

  app.use('/connect-with/*', async (c, next) => {
    c.header("x-powered-by", "Hono Connect Middleware")
    await next()
  }, connect(helmet()))
  app.get('/connect-with/foo', (c) => c.text('foo'))

  app.use('/connect-multi/*', connect((_req, res, next) => {
    res.header("x-powered-by", "Hono Connect Middleware")
    res.status(201)
    next()
  }, helmet()))
  app.get('/connect-multi/foo', (c) => c.text('foo'))

  app.use('/connect-only/*', connect((_req, res) => {
    res.send("Hono is cool")
    res.end()
  }))
  app.get('/connect-only/foo', (c) => c.text('foo'))

  it('Should change header', async () => {
    const res = await app.request('http://localhost/connect/foo')
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(res.headers.get('content-security-policy')).not.toBeNull()
  })

  it('Should remove powered-by header', async () => {
    const res = await app.request('http://localhost/connect-with/foo')
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(res.headers.get('x-powered-by')).toBeNull()
  })

  it('Should remove powered-by header and change status-code with multi connect middleware', async () => {
    const res = await app.request('http://localhost/connect-multi/foo')
    expect(res).not.toBeNull()
    expect(res.status).toBe(201)
    expect(res.headers.get('x-powered-by')).toBeNull()
  })

  it('Should run only connect middleware', async () => {
    const res = await app.request('http://localhost/connect-only/foo')
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(await res.text()).toBe("Hono is cool")
  })
})
