import { Hono } from 'hono'
import { poweredBy } from 'hono/powered-by'
import { connect } from '../src'
import helmet from 'helmet'

describe('Connect middleware', () => {
  const app = new Hono()

  app.use('/connect/*', poweredBy(), connect(helmet({
    xPoweredBy: false
  })))
  app.get('/connect/foo', (c) => c.text('foo'))

  // app.use('/x/*', hello('X'))
  // app.get('/x/foo', (c) => c.text('foo'))

  it('Should remove powered-by header', async () => {
    const res = await app.request('http://localhost/connect/foo')
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(res.headers.get('X-Powered-By')).toBeNull()
  })

  // it('Should be X', async () => {
  //   const res = await app.request('http://localhost/x/foo')
  //   expect(res).not.toBeNull()
  //   expect(res.status).toBe(200)
  //   expect(res.headers.get('X-Message')).toBe('X')
  // })
})
