import { createTestSession } from '../src/helper/testing'
import { app, secret, storage } from './unstorage'

const { soon, recent, encrypt, sid, sub } = createTestSession({ secret })

describe('Unstorage adapter', () => {
  it('gets session data', async () => {
    await storage.set(sid, { sub })
    const cookie = await encrypt({ iat: recent, exp: soon, sid })
    const res = await app.request('/session', {
      headers: { cookie: `sid=${cookie}` },
    })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toStrictEqual({ sub })
  })

  it('updates session data', async () => {
    await storage.set(sid, { sub })
    const newSub = 'new-subject'
    const cookie = await encrypt({ iat: recent, exp: soon, sid })
    const res = await app.request('/session', {
      body: JSON.stringify({ sub: newSub }),
      headers: { cookie: `sid=${cookie}` },
      method: 'PUT',
    })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toStrictEqual({ sub: newSub })
    await expect(storage.get(sid)).resolves.toStrictEqual({ sub: newSub })
  })

  it('deletes session data', async () => {
    await storage.set(sid, { sub })
    const cookie = await encrypt({ iat: recent, exp: soon, sid })
    const res = await app.request('/session', {
      headers: { cookie: `sid=${cookie}` },
      method: 'DELETE',
    })

    expect(res.status).toBe(204)
    await expect(storage.get(sid)).resolves.toBeNull()
  })
})
