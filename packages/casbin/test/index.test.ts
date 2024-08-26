import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { newEnforcer } from 'casbin'
import { casbin } from '../src'
import { basicAuthorizer, jwtAuthorizer } from '../src/helper'
import { sign } from 'hono/jwt'

describe('Casbin Middleware Tests', () => {
  describe('BasicAuthorizer', () => {
    const app = new Hono()
    const enforcer = newEnforcer('examples/model.conf', 'examples/policy.csv')
    app.use('*', casbin({ newEnforcer: enforcer, authorizer: basicAuthorizer }))
    app.get('/dataset1/test', (c) => c.text('dataset1 test'))
    app.post('/dataset1/test', (c) => c.text('dataset1 test'))
    app.put('/dataset1/test', (c) => c.text('dataset1 test'))
    app.delete('/dataset1/test', (c) => c.text('dataset1 test'))

    it('test[Success]: p, alice, /dataset1/*, GET', async () => {
      const req = new Request('http://localhost/dataset1/test', {
        method: 'GET',
        headers: {
          Authorization: `Basic ${Buffer.from('alice:password').toString('base64')}`,
        },
      })
      const res = await app.fetch(req)
      expect(res.status).toBe(200)
    })

    it('test[Success]: p, alice, /dataset1/*, POST', async () => {
      const req = new Request('http://localhost/dataset1/test', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from('alice:password').toString('base64')}`,
        },
      })
      const res = await app.fetch(req)
      expect(res.status).toBe(200)
    })

    it('test[Success]: p, alice, /dataset1/*, PUT', async () => {
      const req = new Request('http://localhost/dataset1/test', {
        method: 'PUT',
        headers: {
          Authorization: `Basic ${Buffer.from('alice:password').toString('base64')}`,
        },
      })
      const res = await app.fetch(req)
      expect(res.status).toBe(200)
    })

    it('test[Success]: p, alice, /dataset1/*, DELETE', async () => {
      const req = new Request('http://localhost/dataset1/test', {
        method: 'DELETE',
        headers: {
          Authorization: `Basic ${Buffer.from('alice:password').toString('base64')}`,
        },
      })
      const res = await app.fetch(req)
      expect(res.status).toBe(200)
    })

    it('test[Not Exist User]: p, cathy, /dataset1/*, - GET 403', async () => {
      const req = new Request('http://localhost/dataset1/test', {
        method: 'GET',
        headers: {
          Authorization: `Basic ${Buffer.from('cathy:password').toString('base64')}`,
        },
      })
      const res = await app.fetch(req)
      expect(res.status).toBe(403)
    })

    it('test[Not Exist User]: p, cathy, /dataset1/*, - POST 403', async () => {
      const req = new Request('http://localhost/dataset1/test', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from('cathy:password').toString('base64')}`,
        },
      })
      const res = await app.fetch(req)
      expect(res.status).toBe(403)
    })

    it('test[Not Exist User]: p, cathy, /dataset1/*, - PUT 403', async () => {
      const req = new Request('http://localhost/dataset1/test', {
        method: 'PUT',
        headers: {
          Authorization: `Basic ${Buffer.from('cathy:password').toString('base64')}`,
        },
      })
      const res = await app.fetch(req)
      expect(res.status).toBe(403)
    })

    it('test[Not Exist User]: p, cathy, /dataset1/*, - DELETE 403', async () => {
      const req = new Request('http://localhost/dataset1/test', {
        method: 'DELETE',
        headers: {
          Authorization: `Basic ${Buffer.from('cathy:password').toString('base64')}`,
        },
      })
      const res = await app.fetch(req)
      expect(res.status).toBe(403)
    })

    it('test[Insufficient Permissions]: p, bob, /dataset1/*, - GET 403', async () => {
      const req = new Request('http://localhost/dataset1/test', {
        method: 'GET',
        headers: {
          Authorization: `Basic ${Buffer.from('bob:password').toString('base64')}`,
        },
      })
      const res = await app.fetch(req)
      expect(res.status).toBe(403)
    })

    it('test[Insufficient Permissions]: p, bob, /dataset1/*, - POST 403', async () => {
      const req = new Request('http://localhost/dataset1/test', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from('bob:password').toString('base64')}`,
        },
      })
      const res = await app.fetch(req)
      expect(res.status).toBe(403)
    })

    it('test[Insufficient Permissions]: p, bob, /dataset1/*, - PUT 403', async () => {
      const req = new Request('http://localhost/dataset1/test', {
        method: 'PUT',
        headers: {
          Authorization: `Basic ${Buffer.from('bob:password').toString('base64')}`,
        },
      })
      const res = await app.fetch(req)
      expect(res.status).toBe(403)
    })

    it('test[Insufficient Permissions]: p, bob, /dataset1/*, - DELETE 403', async () => {
      const req = new Request('http://localhost/dataset1/test', {
        method: 'DELETE',
        headers: {
          Authorization: `Basic ${Buffer.from('bob:password').toString('base64')}`,
        },
      })
      const res = await app.fetch(req)
      expect(res.status).toBe(403)
    })
  })

  describe('JWTAuthorizer', () => {
    const app = new Hono()
    const enforcer = newEnforcer('examples/model.conf', 'examples/policy.csv')
    const claimMapping = { userID: 'sub' }

    app.use(
      '*',
      casbin({ newEnforcer: enforcer, authorizer: (c, e) => jwtAuthorizer(c, e, claimMapping) })
    )
    app.get('/dataset1/test', (c) => c.text('dataset1 test'))
    app.post('/dataset1/test', (c) => c.text('dataset1 test'))
    app.put('/dataset1/test', (c) => c.text('dataset1 test'))
    app.delete('/dataset1/test', (c) => c.text('dataset1 test'))

    it('test[Success]: p, alice, /dataset1/*, GET 200', async () => {
      const token = await sign({ sub: 'alice' }, 'secret')
      const req = new Request('http://localhost/dataset1/test', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      const res = await app.fetch(req)
      expect(res.status).toBe(200)
    })

    it('test[Success]: p, alice, /dataset1/*, POST 200', async () => {
      const token = await sign({ sub: 'alice' }, 'secret')
      const req = new Request('http://localhost/dataset1/test', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      const res = await app.fetch(req)
      expect(res.status).toBe(200)
    })

    it('test[Success]: p, alice, /dataset1/*, PUT 200', async () => {
      const token = await sign({ sub: 'alice' }, 'secret')
      const req = new Request('http://localhost/dataset1/test', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      const res = await app.fetch(req)
      expect(res.status).toBe(200)
    })

    it('test[Success]: p, alice, /dataset1/*, DELETE 200', async () => {
      const token = await sign({ sub: 'alice' }, 'secret')
      const req = new Request('http://localhost/dataset1/test', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      const res = await app.fetch(req)
      expect(res.status).toBe(200)
    })

    it('test[Not Exist User]: p & g, dataset1_admin, /dataset1/*, * - GET 403', async () => {
      const token = await sign({ sub: 'cathy' }, 'secret')
      const req = new Request('http://localhost/dataset1/test', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      const res = await app.fetch(req)
      expect(res.status).toBe(403)
    })

    it('test[Not Exist User]: p & g, dataset1_admin, /dataset1/*, * - POST 403', async () => {
      const token = await sign({ sub: 'cathy' }, 'secret')
      const req = new Request('http://localhost/dataset1/test', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      const res = await app.fetch(req)
      expect(res.status).toBe(403)
    })

    it('test[Not Exist User]: p & g, dataset1_admin, /dataset1/*, * - PUT 403', async () => {
      const token = await sign({ sub: 'cathy' }, 'secret')
      const req = new Request('http://localhost/dataset1/test', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      const res = await app.fetch(req)
      expect(res.status).toBe(403)
    })

    it('test[Not Exist User]: p & g, dataset1_admin, /dataset1/*, * - DELETE 403', async () => {
      const token = await sign({ sub: 'cathy' }, 'secret')
      const req = new Request('http://localhost/dataset1/test', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      const res = await app.fetch(req)
      expect(res.status).toBe(403)
    })

    it('test[Insufficient Permissions]: p, bob, /dataset1/test - GET 403', async () => {
      const token = await sign({ sub: 'bob' }, 'secret')
      const req = new Request('http://localhost/dataset1/test', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      const res = await app.fetch(req)
      expect(res.status).toBe(403)
    })

    it('test[Insufficient Permissions]: p, bob, /dataset1/test - POST 403', async () => {
      const token = await sign({ sub: 'bob' }, 'secret')
      const req = new Request('http://localhost/dataset1/test', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      const res = await app.fetch(req)
      expect(res.status).toBe(403)
    })

    it('test[Insufficient Permissions]: p, bob, /dataset1/test - PUT 403', async () => {
      const token = await sign({ sub: 'bob' }, 'secret')
      const req = new Request('http://localhost/dataset1/test', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      const res = await app.fetch(req)
      expect(res.status).toBe(403)
    })

    it('test[Insufficient Permissions]: p, bob, /dataset1/test - DELETE 403', async () => {
      const token = await sign({ sub: 'bob' }, 'secret')
      const req = new Request('http://localhost/dataset1/test', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      const res = await app.fetch(req)
      expect(res.status).toBe(403)
    })
  })
})
