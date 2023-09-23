/* eslint-disable node/no-extraneous-import */
import { Hono } from 'hono'
import { describe, it, expect } from 'vitest'
import { swaggerUI } from '../src'

describe('Swagger UI', () => {
  it('Should work with default options', async () => {
    const app = new Hono()
    app.use('/docs', swaggerUI())
    const res = await app.request('http://localhost/docs', {
      method: 'GET',
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).includes('text/html')
    expect(await res.text()).includes('<title>Swagger UI</title>')
  })
})
