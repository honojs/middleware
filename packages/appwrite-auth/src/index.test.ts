import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import type { AppwriteAuthConfig } from './index'
import { appwriteMiddleware, initAppwrite } from './index'

describe('Appwrite middleware', () => {
  const app = new Hono()

  const appwriteConfig: AppwriteAuthConfig = {
    endpoint  : 'https://cloud.appwrite.io/v1',
    projectId : 'PROJECT_ID',
    apiKey    : 'API_KEY',
    cookieName: 'appwrite-secure-cookie',
  }

  app.get('/', (c) => c.json({ success: true }))

  app.use('/api/*', initAppwrite(appwriteConfig))
  app.use('/api/*', appwriteMiddleware())

  app.get('/api/whoami', (c) => c.json({ success: true }))


  it('it Should return 200', async () => {
    const res = await app.request('/')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
  })

  it('it Should return 401', async () => {
    const res = await app.request('/api/whoami')
    expect(res.status).toBe(401)
    expect(await res.text()).toEqual('Unauthorized')
  })

  it('it Should return 403', async () => {
    const res = await app.request('/api/whoami', { credentials: 'include', headers: { 'cookie': 'appwrite-secure-cookie=cookieID' } })
    expect(res.status).toBe(403)
    expect(await res.text()).toEqual('Forbidden')
  })

})
