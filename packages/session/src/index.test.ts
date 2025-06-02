import { Hono } from 'hono'
import { createTestSession } from './helper/testing'
import type { RefreshSession } from './session'
import type { SessionData } from '.'
import { session, sessionStorage } from '.'

interface TestData extends SessionData {
  sub: string
}

const {
  decrypt,
  encrypt,
  getCookie,
  getEncryptionKey,
  offset,
  recent,
  secret,
  sessionCookie,
  sid,
  sub,
} = createTestSession()

const encryptionKey = await getEncryptionKey()

const storage = new Map<string, TestData>()

const testSessionStorage = sessionStorage({
  delete(sid) {
    storage.delete(sid)
  },
  get(sid) {
    return storage.get(sid) ?? null
  },
  set(sid, value) {
    storage.set(sid, value)
  },
})

beforeEach(() => {
  storage.clear()
})

describe('session.data', () => {
  const app = new Hono()
    .get('/session', session<TestData>({ secret }), async (c) => {
      return c.json(c.var.session.data)
    })
    .delete('/session', session<TestData>({ secret }), async (c) => {
      c.var.session.delete()
      return c.json(c.var.session.data)
    })

  it('throws an error when session has not been initialised', async () => {
    const res = await app.request('/session')
    const session = await getCookie(res, 'sid', decrypt)

    expect(res.status).toBe(500)
    expect(session.cookie).toBeNull()
  })

  it('throws an error when session has been destroyed', async () => {
    const res = await app.request('/session', {
      method: 'DELETE',
    })
    const session = await getCookie(res, 'sid', decrypt)

    expect(res.status).toBe(500)
    expect(session.cookie).toStrictEqual({
      'Max-Age': '0',
      Path: '/',
      SameSite: 'Lax',
      [session.name]: null,
    })
  })
})

describe('session.get()', () => {
  const app = new Hono().get('/session', session<TestData>({ secret }), async (c) => {
    const session = await c.var.session.get()
    return c.json(session)
  })

  it('creates a new session', async () => {
    const res = await app.request('/session')
    const session = await getCookie(res, 'sid', decrypt)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toBeNull()
    expect(session.cookie).toStrictEqual({
      Path: '/',
      SameSite: 'Lax',
      [session.name]: {
        iat: expect.toSatisfy((iat) => iat > recent),
        sid: expect.toSatisfy((newSid) => newSid !== sid),
      },
    })
  })

  it('gets the current session', async () => {
    const sessionDataCookie = { ...sessionCookie, sub }
    const res = await app.request('/session', {
      headers: { cookie: `sid=${await encrypt(sessionDataCookie)}` },
    })
    const session = await getCookie(res, 'sid', decrypt)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toStrictEqual({ sub })
    expect(session.cookie).toStrictEqual(null)
  })

  it('replaces an invalid session cookie', async () => {
    const invalidSessionCookie = await encrypt({})
    const res = await app.request('/session', {
      headers: { cookie: `sid=${invalidSessionCookie};` },
    })
    const session = await getCookie(res, 'sid', decrypt)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toBeNull()
    expect(session.cookie).toStrictEqual({
      Path: '/',
      SameSite: 'Lax',
      [session.name]: {
        iat: expect.toSatisfy((iat) => iat > recent),
        sid: expect.toSatisfy((newSid) => newSid !== sid),
      },
    })
  })
})

describe('session.get(refresh)', () => {
  const refresh = vi.fn<RefreshSession<TestData>>()

  const app = new Hono().get(
    '/session',
    session<TestData>({
      secret,
      sessionCookie: { duration: { absolute: offset * 3 } },
    }),
    async (c) => {
      const data = await c.var.session.get(refresh)
      return c.json(data)
    }
  )

  it('refreshes an expired session', async () => {
    const newSub = 'new-subject'
    refresh.mockResolvedValue({ sub: newSub })
    const expiredSessionCookie = await encrypt({ ...sessionCookie, exp: recent, sub })
    const res = await app.request('/session', {
      headers: { cookie: `sid=${expiredSessionCookie};` },
    })
    const session = await getCookie(res, 'sid', decrypt)
    const data = await res.json()

    expect(refresh).toHaveBeenCalledWith({ sub })
    expect(res.status).toBe(200)
    expect(data).toStrictEqual({ sub: newSub })
    expect(session.cookie).toStrictEqual({
      'Max-Age': '7200',
      Path: '/',
      SameSite: 'Lax',
      [session.name]: {
        exp: expect.toSatisfy((exp) => exp > sessionCookie.exp),
        iat: sessionCookie.iat,
        sid: sessionCookie.sid,
        sub: newSub,
      },
    })
  })

  it('replaces the session when refresh returns null', async () => {
    refresh.mockResolvedValue(null)
    const expiredSessionCookie = await encrypt({ ...sessionCookie, exp: recent, sub })
    const res = await app.request('/session', {
      headers: { cookie: `sid=${expiredSessionCookie};` },
    })
    const session = await getCookie(res, 'sid', decrypt)
    const data = await res.json()

    expect(refresh).toHaveBeenCalledWith({ sub })
    expect(res.status).toBe(200)
    expect(data).toBeNull()
    expect(session.cookie).toStrictEqual({
      'Max-Age': '10800',
      Path: '/',
      SameSite: 'Lax',
      [session.name]: {
        exp: expect.toSatisfy((exp) => exp > sessionCookie.exp),
        iat: expect.toSatisfy((iat) => iat > sessionCookie.iat),
        sid: expect.toSatisfy((newSid) => newSid !== sessionCookie.sid),
      },
    })
  })

  it('deletes the session when refresh fails', async () => {
    refresh.mockRejectedValue(new Error('Refresh failed'))
    const expiredSessionCookie = await encrypt({ ...sessionCookie, exp: recent, sub })
    const res = await app.request('/session', {
      headers: { cookie: `sid=${expiredSessionCookie};` },
    })
    const session = await getCookie(res, 'sid', decrypt)

    expect(refresh).toHaveBeenCalledWith({ sub })
    expect(res.status).toBe(500)
    expect(session.cookie).toStrictEqual({
      'Max-Age': '0',
      Path: '/',
      SameSite: 'Lax',
      [session.name]: null,
    })
  })
})

describe('session.update()', () => {
  const app = new Hono().put('/session/:sub', session<TestData>({ secret }), async (c) => {
    await c.var.session.update({ sub: c.req.param('sub') })
    return c.json(c.var.session.data)
  })

  it('creates a new session with data', async () => {
    const res = await app.request(`/session/${sub}`, { method: 'PUT' })
    const session = await getCookie(res, 'sid', decrypt)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toStrictEqual({ sub })
    expect(session.cookie).toStrictEqual({
      Path: '/',
      SameSite: 'Lax',
      [session.name]: {
        iat: expect.toSatisfy((iat) => iat > recent),
        sid: expect.toSatisfy((newSid) => newSid !== sid),
        sub,
      },
    })
  })

  it('updates the current session', async () => {
    const newSub = 'new-subject'
    const res = await app.request(`/session/${newSub}`, {
      headers: { cookie: `sid=${await encrypt(sessionCookie)}` },
      method: 'PUT',
    })
    const session = await getCookie(res, 'sid', decrypt)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toStrictEqual({ sub: newSub })
    expect(session.cookie).toStrictEqual({
      Path: '/',
      SameSite: 'Lax',
      [session.name]: {
        ...sessionCookie,
        sub: newSub,
      },
    })
  })

  it('replaces an expired session', async () => {
    const newSub = 'new-subject'
    const res = await app.request(`/session/${newSub}`, {
      headers: { cookie: `sid=${await encrypt({ ...sessionCookie, exp: recent })}` },
      method: 'PUT',
    })
    const session = await getCookie(res, 'sid', decrypt)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toStrictEqual({ sub: newSub })
    expect(session.cookie).toStrictEqual({
      Path: '/',
      SameSite: 'Lax',
      [session.name]: {
        iat: expect.toSatisfy((iat) => iat > sessionCookie.iat),
        sid: expect.toSatisfy((newSid) => newSid !== sessionCookie.sid),
        sub: newSub,
      },
    })
  })
})

describe('session.update(fn)', () => {
  const app = new Hono().put('/session/:sub', session<TestData>({ secret }), async (c) => {
    await c.var.session.update((data) => ({ ...data, sub: c.req.param('sub') }))
    return c.json(c.var.session.data)
  })

  it('creates a new session with data', async () => {
    const res = await app.request(`/session/${sub}`, { method: 'PUT' })
    const session = await getCookie(res, 'sid', decrypt)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toStrictEqual({ sub })
    expect(session.cookie).toStrictEqual({
      Path: '/',
      SameSite: 'Lax',
      [session.name]: {
        iat: expect.toSatisfy((iat) => iat > recent),
        sid: expect.toSatisfy((newSid) => newSid !== sid),
        sub,
      },
    })
  })

  it('updates the current session', async () => {
    const newSub = 'new-subject'
    const res = await app.request(`/session/${newSub}`, {
      headers: { cookie: `sid=${await encrypt({ ...sessionCookie, aud: 'audience' })}` },
      method: 'PUT',
    })
    const session = await getCookie(res, 'sid', decrypt)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toStrictEqual({ aud: 'audience', sub: newSub })
    expect(session.cookie).toStrictEqual({
      Path: '/',
      SameSite: 'Lax',
      [session.name]: {
        ...sessionCookie,
        aud: 'audience',
        sub: newSub,
      },
    })
  })
})

describe('session.delete()', () => {
  const app = new Hono().delete('/session', session<TestData>({ secret }), async (c) => {
    c.var.session.delete()
    return c.body(null, 204)
  })

  it('deletes the current session', async () => {
    const res = await app.request('/session', {
      headers: { cookie: `sid=${await encrypt(sessionCookie)}` },
      method: 'DELETE',
    })
    const session = await getCookie(res, 'sid', decrypt)

    expect(res.status).toBe(204)
    expect(session.cookie).toStrictEqual({
      'Max-Age': '0',
      Path: '/',
      SameSite: 'Lax',
      [session.name]: null,
    })
  })
})

describe('session.get() with storage', () => {
  const app = new Hono().get('/session', testSessionStorage, session({ secret }), async (c) => {
    const session = await c.var.session.get()
    return c.json(session)
  })

  it('creates a new session', async () => {
    const res = await app.request('/session')
    const session = await getCookie(res, 'sid', decrypt)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toBeNull()
    expect(session.cookie).toStrictEqual({
      Path: '/',
      SameSite: 'Lax',
      [session.name]: {
        iat: expect.toSatisfy((iat) => iat > recent),
        sid: expect.toSatisfy((newSid) => newSid !== sid),
      },
    })
    expect(storage.size).toBe(0)
  })

  it('creates a new session when the current session is not found', async () => {
    const getSpy = vi.spyOn(storage, 'get')
    const setSpy = vi.spyOn(storage, 'set')
    const res = await app.request('/session', {
      headers: { cookie: `sid=${await encrypt(sessionCookie)}` },
    })
    const session = await getCookie(res, 'sid', decrypt)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toBeNull()
    expect(session.cookie).toStrictEqual({
      Path: '/',
      SameSite: 'Lax',
      [session.name]: {
        iat: expect.toSatisfy((iat) => iat > sessionCookie.iat),
        sid: expect.toSatisfy((sid) => sid !== sessionCookie.sid),
      },
    })
    expect(getSpy).toHaveBeenCalledWith(sid)
    expect(setSpy).not.toBeCalled()
    expect(storage.size).toBe(0)
  })

  it('gets the current session', async () => {
    storage.set(sid, { sub })
    const res = await app.request('/session', {
      headers: { cookie: `sid=${await encrypt(sessionCookie)}` },
    })
    const session = await getCookie(res, 'sid', decrypt)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toStrictEqual({ sub })
    expect(session.cookie).toStrictEqual(null)
  })

  it('replaces an invalid session cookie', async () => {
    const res = await app.request('/session', { headers: { cookie: 'session;' } })
    const session = await getCookie(res, 'sid', decrypt)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toBeNull()
    expect(session.cookie).toStrictEqual({
      Path: '/',
      SameSite: 'Lax',
      [session.name]: {
        iat: expect.toSatisfy((iat) => iat > recent),
        sid: expect.toSatisfy((newSid) => newSid !== sid),
      },
    })
  })

  it('replaces an expired session', async () => {
    const expiredSessionCookie = await encrypt({ ...sessionCookie, exp: recent })
    storage.set(sid, { sub })
    const res = await app.request('/session', {
      headers: { cookie: `sid=${expiredSessionCookie};` },
    })
    const session = await getCookie(res, 'sid', decrypt)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toBeNull()
    expect(session.cookie).toStrictEqual({
      Path: '/',
      SameSite: 'Lax',
      [session.name]: {
        iat: expect.toSatisfy((iat) => iat > recent),
        sid: expect.toSatisfy((newSid) => newSid !== sid),
      },
    })
    // Does not remove the expired session from the store
    expect(storage.size).toBe(1)
  })
})

describe('session.get(refresh) with storage', () => {
  const refresh = vi.fn<RefreshSession<TestData>>()

  const app = new Hono().get(
    '/session',
    testSessionStorage,
    session<TestData>({
      secret,
      sessionCookie: { duration: { absolute: offset * 3 } },
    }),
    async (c) => {
      await c.var.session.get(refresh)
      return c.json(c.var.session.data)
    }
  )

  it('refreshes an expired session', async () => {
    refresh.mockImplementation((data) => Promise.resolve(data))
    const expiredSessionCookie = await encrypt({ ...sessionCookie, exp: recent })
    storage.set(sid, { sub })
    const res = await app.request(`/session`, {
      headers: { cookie: `sid=${expiredSessionCookie};` },
    })
    const session = await getCookie(res, 'sid', decrypt)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toStrictEqual({ sub })
    expect(session.cookie).toStrictEqual({
      'Max-Age': '7200',
      Path: '/',
      SameSite: 'Lax',
      [session.name]: {
        exp: expect.toSatisfy((exp) => exp > sessionCookie.exp),
        iat: sessionCookie.iat,
        sid: sessionCookie.sid,
      },
    })
    expect(storage.size).toBe(1)
  })

  it('replaces the session when refresh returns null', async () => {
    refresh.mockResolvedValue(null)
    const expiredSessionCookie = await encrypt({ ...sessionCookie, exp: recent })
    storage.set(sid, { sub })
    const res = await app.request('/session', {
      headers: { cookie: `sid=${expiredSessionCookie};` },
    })
    const session = await getCookie(res, 'sid', decrypt)
    const data = await res.json()

    expect(refresh).toHaveBeenCalledWith({ sub })
    expect(res.status).toBe(200)
    expect(data).toBeNull()
    expect(session.cookie).toStrictEqual({
      'Max-Age': '10800',
      Path: '/',
      SameSite: 'Lax',
      [session.name]: {
        exp: expect.toSatisfy((exp) => exp > sessionCookie.exp),
        iat: expect.toSatisfy((iat) => iat > sessionCookie.iat),
        sid: expect.toSatisfy((newSid) => newSid !== sessionCookie.sid),
      },
    })
  })

  it('deletes the session when refresh fails', async () => {
    refresh.mockRejectedValue(new Error('Refresh failed'))
    const expiredSessionCookie = await encrypt({ ...sessionCookie, exp: recent })
    storage.set(sid, { sub })
    const res = await app.request('/session', {
      headers: { cookie: `sid=${expiredSessionCookie};` },
    })
    const session = await getCookie(res, 'sid', decrypt)

    expect(refresh).toHaveBeenCalledWith({ sub })
    expect(res.status).toBe(500)
    expect(session.cookie).toStrictEqual({
      'Max-Age': '0',
      Path: '/',
      SameSite: 'Lax',
      [session.name]: null,
    })
  })
})

describe('session.update() with storage', () => {
  const app = new Hono().put(
    '/session/:sub',
    testSessionStorage,
    session({ secret }),
    async (c) => {
      await c.var.session.update({ sub: c.req.param('sub') })
      return c.json(c.var.session.data)
    }
  )

  it('creates a new session with data', async () => {
    const setSpy = vi.spyOn(storage, 'set')
    const res = await app.request(`/session/${sub}`, { method: 'PUT' })
    const session = await getCookie(res, 'sid', decrypt)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toStrictEqual({ sub })
    expect(session.cookie).toStrictEqual({
      Path: '/',
      SameSite: 'Lax',
      [session.name]: {
        iat: expect.toSatisfy((iat) => iat > recent),
        sid: expect.toSatisfy((newSid) => newSid !== sid),
      },
    })
    expect(setSpy).toHaveBeenCalledWith(expect.any(String), { sub })
    expect(storage.size).toBe(1)
    expect([...storage.values()]).toContainEqual({ sub })
  })

  it('updates the current session', async () => {
    const newSub = 'new-subject'
    storage.set(sid, { sub })
    const res = await app.request(`/session/${newSub}`, {
      headers: { cookie: `sid=${await encrypt(sessionCookie)}` },
      method: 'PUT',
    })
    const session = await getCookie(res, 'sid', decrypt)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toStrictEqual({ sub: newSub })
    expect(session.cookie).toBeNull()
    expect(storage.size).toBe(1)
    expect([...storage.values()]).toStrictEqual([{ sub: newSub }])
  })

  it('replaces an expired session', async () => {
    const newSub = 'new-subject'
    storage.set(sid, { sub })
    const res = await app.request(`/session/${newSub}`, {
      headers: { cookie: `sid=${await encrypt({ ...sessionCookie, exp: recent })}` },
      method: 'PUT',
    })
    const session = await getCookie(res, 'sid', decrypt)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toStrictEqual({ sub: newSub })
    expect(session.cookie).toStrictEqual({
      Path: '/',
      SameSite: 'Lax',
      [session.name]: {
        iat: expect.toSatisfy((iat) => iat > sessionCookie.iat),
        sid: expect.toSatisfy((newSid) => newSid !== sessionCookie.sid),
      },
    })
    expect(storage.size).toBe(1)
    expect([...storage.values()]).toStrictEqual([{ sub: newSub }])
  })
})

describe('session.update(fn) with storage', () => {
  const app = new Hono().put(
    '/session/:sub',
    testSessionStorage,
    session({ secret }),
    async (c) => {
      await c.var.session.update((data) => ({ ...data, sub: c.req.param('sub') }))
      return c.json(c.var.session.data)
    }
  )

  it('creates a new session with data', async () => {
    const setSpy = vi.spyOn(storage, 'set')
    const res = await app.request(`/session/${sub}`, { method: 'PUT' })
    const session = await getCookie(res, 'sid', decrypt)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toStrictEqual({ sub })
    expect(session.cookie).toStrictEqual({
      Path: '/',
      SameSite: 'Lax',
      [session.name]: {
        iat: expect.toSatisfy((iat) => iat > recent),
        sid: expect.toSatisfy((newSid) => newSid !== sid),
      },
    })
    expect(setSpy).toHaveBeenCalledWith(expect.any(String), { sub })
    expect(storage.size).toBe(1)
    expect([...storage.values()]).toContainEqual({ sub })
  })

  it('updates the current session', async () => {
    const newSub = 'new-subject'
    storage.set(sid, { aud: 'audience', sub })
    const res = await app.request(`/session/${newSub}`, {
      headers: { cookie: `sid=${await encrypt(sessionCookie)}` },
      method: 'PUT',
    })
    const session = await getCookie(res, 'sid', decrypt)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toStrictEqual({ aud: 'audience', sub: newSub })
    expect(session.cookie).toBeNull()
    expect(storage.size).toBe(1)
    expect([...storage.values()]).toStrictEqual([{ aud: 'audience', sub: newSub }])
  })

  it('replaces an expired session', async () => {
    const newSub = 'new-subject'
    storage.set(sid, { sub })
    const res = await app.request(`/session/${newSub}`, {
      headers: { cookie: `sid=${await encrypt({ ...sessionCookie, exp: recent })}` },
      method: 'PUT',
    })
    const session = await getCookie(res, 'sid', decrypt)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toStrictEqual({ sub: newSub })
    expect(session.cookie).toStrictEqual({
      Path: '/',
      SameSite: 'Lax',
      [session.name]: {
        iat: expect.toSatisfy((iat) => iat > sessionCookie.iat),
        sid: expect.toSatisfy((newSid) => newSid !== sessionCookie.sid),
      },
    })
    expect(storage.size).toBe(1)
    expect([...storage.values()]).toStrictEqual([{ sub: newSub }])
  })
})

describe('session.delete() with storage', () => {
  const app = new Hono().delete('/session', testSessionStorage, session({ secret }), async (c) => {
    c.var.session.delete()
    return c.body(null, 204)
  })

  it('deletes the current session', async () => {
    storage.set(sid, { sub })
    const res = await app.request('/session', {
      headers: { cookie: `sid=${await encrypt(sessionCookie)}` },
      method: 'DELETE',
    })
    const session = await getCookie(res, 'sid', decrypt)

    expect(res.status).toBe(204)
    expect(session.cookie).toStrictEqual({
      'Max-Age': '0',
      Path: '/',
      SameSite: 'Lax',
      [session.name]: null,
    })
    // Does not remove the expired session from the store
    expect(storage.size).toBe(1)
  })

  it('deletes an inavlid session cookie', async () => {
    const invalidSessionCookie = await encrypt({})
    const res = await app.request('/session', {
      headers: { cookie: `sid=${invalidSessionCookie}` },
      method: 'DELETE',
    })
    const session = await getCookie(res, 'sid', decrypt)

    expect(res.status).toBe(204)
    expect(session.cookie).toStrictEqual({
      'Max-Age': '0',
      Path: '/',
      SameSite: 'Lax',
      [session.name]: null,
    })
  })
})

describe('options.sessionCookie.name', () => {
  const app = new Hono().get(
    '/session',
    session<TestData>({ secret, sessionCookie: { name: 'my-session' } }),
    (c) => {
      const data = c.var.session.get()
      return c.json(data)
    }
  )

  it('sets the name of the session cookie', async () => {
    const res = await app.request('/session')
    const session = await getCookie(res, 'my-session', decrypt)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toStrictEqual({})
    expect(session.cookie).toStrictEqual({
      Path: '/',
      SameSite: 'Lax',
      [session.name]: {
        iat: expect.toSatisfy((iat) => iat > recent),
        sid: expect.toSatisfy((newSid) => newSid !== sid),
      },
    })
  })
})

describe('options.sessionCookie.options.prefix', () => {
  const app = new Hono()
    .use(testSessionStorage)
    .get(
      '/secure-session',
      session<TestData>({ secret, sessionCookie: { options: { prefix: 'secure' } } }),
      async (c) => {
        const data = await c.var.session.get()
        return c.json(data)
      }
    )
    .get(
      '/host-session',
      session<TestData>({ secret, sessionCookie: { options: { prefix: 'host' } } }),
      async (c) => {
        const data = await c.var.session.get()
        return c.json(data)
      }
    )

  it('sets the secure cookie prefix', async () => {
    storage.set(sid, { sub })
    const res = await app.request('/secure-session', {
      headers: { cookie: `__Secure-sid=${await encrypt(sessionCookie)}` },
    })
    const session = await getCookie(res, 'sid', decrypt)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toStrictEqual({ sub })
    expect(session.cookie).toBeNull()
  })

  it('sets the host cookie prefix', async () => {
    storage.set(sid, { sub })
    const res = await app.request('/host-session', {
      headers: { cookie: `__Host-sid=${await encrypt(sessionCookie)}` },
    })
    const session = await getCookie(res, 'sid', decrypt)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toStrictEqual({ sub })
    expect(session.cookie).toBeNull()
  })
})

describe('options.sessionCookie.duration.absolute', () => {
  const refresh = vi.fn<RefreshSession<TestData>>()

  const app = new Hono().get(
    '/session',
    testSessionStorage,
    session<TestData>({
      secret,
      sessionCookie: { duration: { absolute: offset * 10 } },
    }),
    async (c) => {
      const data = await c.var.session.get(refresh)
      return c.json(data)
    }
  )

  it('sets session expiry time and cookie Max-Age attribute', async () => {
    const res = await app.request('/session')
    const session = await getCookie(res, 'sid', decrypt)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toBeNull()
    expect(session.cookie).toStrictEqual({
      'Max-Age': '36000',
      Path: '/',
      SameSite: 'Lax',
      [session.name]: {
        exp: expect.toSatisfy((exp) => exp > recent),
        iat: expect.toSatisfy((iat) => iat > recent),
        sid: expect.toSatisfy((newSid) => newSid !== sid),
      },
    })
  })

  it('updates the cookie Max-Age attribute when refreshing an expired session', async () => {
    const newSub = 'new-subject'
    refresh.mockResolvedValue({ sub: newSub })
    const expiredSessionCookie = await encrypt({ ...sessionCookie, exp: recent })
    storage.set(sid, { sub })
    const res = await app.request('/session', {
      headers: { cookie: `sid=${expiredSessionCookie};` },
    })
    const session = await getCookie(res, 'sid', decrypt)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toStrictEqual({ sub: newSub })
    expect(session.cookie).toMatchObject({
      'Max-Age': '32400',
      Path: '/',
      SameSite: 'Lax',
      [session.name]: {
        exp: expect.toSatisfy((exp) => exp > sessionCookie.exp),
        iat: sessionCookie.iat,
        sid: sessionCookie.sid,
      },
    })
  })
})

describe('options.sessionCookie.duration.inactivity', () => {
  const refresh = vi.fn<RefreshSession<TestData>>()

  const app = new Hono().get(
    '/session',
    testSessionStorage,
    session<TestData>({
      secret,
      sessionCookie: { duration: { absolute: offset * 10, inactivity: offset * 3 } },
    }),
    async (c) => {
      const data = await c.var.session.get(refresh)
      return c.json(data)
    }
  )

  it('sets session expiry time and cookie Max-Age attribute', async () => {
    const res = await app.request('/session')
    const session = await getCookie(res, 'sid', decrypt)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toBeNull()
    expect(session.cookie).toStrictEqual({
      'Max-Age': '10800',
      Path: '/',
      SameSite: 'Lax',
      [session.name]: {
        exp: expect.toSatisfy((exp) => exp > recent),
        iat: expect.toSatisfy((iat) => iat > recent),
        sid: expect.toSatisfy((newSid) => newSid !== sid),
      },
    })
  })

  it('refreshes an expired session', async () => {
    const newSub = 'new-subject'
    refresh.mockResolvedValue({ sub: newSub })
    const expiredSessionCookie = await encrypt({ ...sessionCookie, exp: recent })
    storage.set(sid, { sub })
    const res = await app.request('/session', {
      headers: { cookie: `sid=${expiredSessionCookie};` },
    })
    const session = await getCookie(res, 'sid', decrypt)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toStrictEqual({ sub: newSub })
    expect(session.cookie).toMatchObject({
      'Max-Age': '10800',
      Path: '/',
      SameSite: 'Lax',
      [session.name]: {
        exp: expect.toSatisfy((exp) => exp > sessionCookie.exp),
        iat: sessionCookie.iat,
        sid: sessionCookie.sid,
      },
    })
  })
})

describe('options.secret', () => {
  const app = new Hono()
    .get('/encryption-key', session<TestData>({ secret: encryptionKey }), async (c) => {
      const data = await c.var.session.get()
      return c.json(data)
    })
    .get('/missing-secret', session<TestData>(), async (c) => {
      const data = await c.var.session.get()
      return c.json(data)
    })

  it('accepts an encryption key', async () => {
    const res = await app.request('/encryption-key', {
      headers: { cookie: `sid=${await encrypt({ ...sessionCookie, sub })}` },
    })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toStrictEqual({ sub })
  })

  it('throws an error when undefined', async () => {
    const res = await app.request('/missing-secret', {}, { AUTH_SECRET: undefined })
    const session = await getCookie(res, 'sid', decrypt)

    expect(res.status).toBe(500)
    expect(session.cookie).toBeNull()
  })
})

describe('session events', () => {
  const onCreate = vi.fn()
  const onDelete = vi.fn()
  const onRefresh = vi.fn()
  const onUpdate = vi.fn()

  const refresh = vi.fn<RefreshSession<TestData>>()

  const sessionEvents = session<TestData>({ secret, onCreate, onDelete, onRefresh, onUpdate })

  const app = new Hono()
    .get('/session', sessionEvents, async (c) => {
      const session = await c.var.session.get(refresh)
      return c.json(session)
    })
    .put('/session/:sub', sessionEvents, async (c) => {
      await c.var.session.update({ sub: c.req.param('sub') })
      return c.json(c.var.session.data)
    })
    .delete('/session', sessionEvents, async (c) => {
      await c.var.session.get()
      c.var.session.delete()
      return c.body(null, 204)
    })

  it('emits create events', async () => {
    await app.request(`/session/${sub}`, { method: 'PUT' })

    expect(refresh).not.toHaveBeenCalled()
    expect(onCreate).toHaveBeenCalledWith({ sub })
    expect(onDelete).not.toHaveBeenCalled()
    expect(onRefresh).not.toHaveBeenCalled()
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('emits delete events', async () => {
    await app.request('/session', {
      headers: { cookie: `sid=${await encrypt({ ...sessionCookie, sub })}` },
      method: 'DELETE',
    })

    expect(refresh).not.toHaveBeenCalled()
    expect(onCreate).not.toHaveBeenCalled()
    expect(onUpdate).not.toHaveBeenCalled()
    expect(onRefresh).not.toHaveBeenCalled()
    expect(onDelete).toHaveBeenCalledWith({ sub })
  })

  it('emits refresh events', async () => {
    const newSub = 'new-subject'
    refresh.mockResolvedValue({ sub: newSub })

    const expiredSessionCookie = await encrypt({ ...sessionCookie, exp: recent, sub })
    await app.request('/session', {
      headers: { cookie: `sid=${expiredSessionCookie}` },
    })

    expect(refresh).toHaveBeenCalledWith({ sub })
    expect(onCreate).not.toHaveBeenCalled()
    expect(onUpdate).not.toHaveBeenCalled()
    expect(onRefresh).toHaveBeenCalledWith({ sub: newSub })
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('emits update events', async () => {
    await app.request(`/session/${sub}`, {
      headers: { cookie: `sid=${await encrypt(sessionCookie)}` },
      method: 'PUT',
    })

    expect(refresh).not.toHaveBeenCalled()
    expect(onCreate).not.toHaveBeenCalled()
    expect(onDelete).not.toHaveBeenCalled()
    expect(onRefresh).not.toHaveBeenCalled()
    expect(onUpdate).toHaveBeenCalledWith({ sub })
  })
})
