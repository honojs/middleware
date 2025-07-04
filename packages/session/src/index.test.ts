import { Hono } from 'hono'
import { createTestSession } from './helper/testing'
import type { Refresh } from './session'
import type { SessionData } from '.'
import { useSession, useSessionStorage } from '.'

interface TestData extends SessionData {
  sub: string
}

const {
  decrypt,
  encrypt,
  getSetCookie,
  getEncryptionKey,
  offset,
  recent,
  secret,
  session,
  sid,
  sub,
} = createTestSession()

const encryptionKey = await getEncryptionKey()

const storage = new Map<string, TestData>()

const testSessionStorage = useSessionStorage({
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
  const onError = vi.fn()
  const app = new Hono()
    .get('/session', useSession<TestData>({ secret }), (c) => {
      return c.json(c.var.session.data)
    })
    .delete('/session', useSession<TestData>({ secret }), (c) => {
      c.var.session.delete()
      return c.json(c.var.session.data)
    })
    .onError((err, c) => {
      onError(err)
      return c.body('Internal Server Error', 500)
    })

  it('throws an error when session has not been initialised', async () => {
    const res = await app.request('/session')
    const sessionCookie = await getSetCookie(res, 'sid', decrypt)

    expect(res.status).toBe(500)
    expect(sessionCookie).toBeUndefined()
    expect(onError).toHaveBeenCalledWith(
      new Error('Session not initialised. Call get() or update() first.')
    )
  })

  it('throws an error when session has been destroyed', async () => {
    const res = await app.request('/session', { method: 'DELETE' })
    const sessionCookie = await getSetCookie(res, 'sid', decrypt)

    expect(res.status).toBe(500)
    expect(sessionCookie?.attributes).toStrictEqual({
      'Max-Age': '0',
      Path: '/',
      SameSite: 'Lax',
    })
    expect(sessionCookie?.value).toBeNull()
    expect(onError).toHaveBeenCalledWith(new Error('Session has been destroyed.'))
  })
})

describe('session.get()', () => {
  const app = new Hono().get('/session', useSession<TestData>({ secret }), async (c) => {
    const session = await c.var.session.get()
    return c.json(session)
  })

  it('creates a new session', async () => {
    const res = await app.request('/session')
    const sessionCookie = await getSetCookie(res, 'sid', decrypt)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toBeNull()
    expect(sessionCookie?.attributes).toStrictEqual({
      Path: '/',
      SameSite: 'Lax',
    })
    expect(sessionCookie?.payload.iat).toBeGreaterThan(recent)
    expect(sessionCookie?.payload.sid).not.toStrictEqual(sid)
  })

  it('gets the current session', async () => {
    const cookie = await encrypt({ ...session.payload, sub })
    const res = await app.request('/session', { headers: { cookie: `sid=${cookie}` } })
    const sessionCookie = await getSetCookie(res, 'sid', decrypt)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toStrictEqual({ sub })
    expect(sessionCookie).toBeUndefined()
  })

  it('replaces an invalid session cookie', async () => {
    const invalidSession = {}
    const cookie = await encrypt(invalidSession)
    const res = await app.request('/session', { headers: { cookie: `sid=${cookie}` } })
    const sessionCookie = await getSetCookie(res, 'sid', decrypt)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toBeNull()
    expect(sessionCookie?.attributes).toStrictEqual({
      Path: '/',
      SameSite: 'Lax',
    })
    expect(sessionCookie?.payload.iat).toBeGreaterThan(recent)
    expect(sessionCookie?.payload.sid).not.toStrictEqual(sid)
  })
})

describe('session.get(refresh)', () => {
  const refresh = vi.fn<Refresh<TestData>>()

  const app = new Hono().get(
    '/session',
    useSession<TestData>({ secret, duration: { absolute: offset * 3 } }),
    async (c) => {
      const data = await c.var.session.get(refresh)
      return c.json(data)
    }
  )

  it('refreshes an expired session', async () => {
    const newSub = 'new-subject'
    refresh.mockResolvedValue({ sub: newSub })
    const expiredSession = { ...session.payload, exp: recent, iat: recent, sub }
    const cookie = await encrypt(expiredSession)
    const res = await app.request('/session', { headers: { cookie: `sid=${cookie}` } })
    const sessionCookie = await getSetCookie(res, 'sid', decrypt)
    const data = await res.json()

    expect(refresh).toHaveBeenCalledWith({ sub })
    expect(res.status).toBe(200)
    expect(data).toStrictEqual({ sub: newSub })
    expect(sessionCookie?.attributes).toStrictEqual({
      'Max-Age': '7200',
      Path: '/',
      SameSite: 'Lax',
    })
    expect(sessionCookie?.payload.exp).toBeGreaterThan(expiredSession.exp)
    expect(sessionCookie?.payload.iat).toStrictEqual(expiredSession.iat)
    expect(sessionCookie?.payload.sid).toStrictEqual(expiredSession.sid)
    expect(sessionCookie?.payload.sub).toStrictEqual(newSub)
  })

  it('replaces the session when refresh returns null', async () => {
    refresh.mockResolvedValue(null)
    const expiredSession = { ...session.payload, exp: recent, iat: recent, sub }
    const cookie = await encrypt(expiredSession)
    const res = await app.request('/session', { headers: { cookie: `sid=${cookie}` } })
    const sessionCookie = await getSetCookie(res, 'sid', decrypt)
    const data = await res.json()

    expect(refresh).toHaveBeenCalledWith({ sub })
    expect(res.status).toBe(200)
    expect(data).toBeNull()
    expect(sessionCookie?.attributes).toStrictEqual({
      'Max-Age': '10800',
      Path: '/',
      SameSite: 'Lax',
    })
    expect(sessionCookie?.payload.exp).toBeGreaterThan(expiredSession.exp)
    expect(sessionCookie?.payload.iat).toBeGreaterThan(expiredSession.iat)
    expect(sessionCookie?.payload.sid).not.toStrictEqual(expiredSession.sid)
  })

  it('deletes the session when refresh fails', async () => {
    refresh.mockRejectedValue(new Error('Refresh failed'))
    const expiredSession = { ...session.payload, exp: recent, sub }
    const cookie = await encrypt(expiredSession)
    const res = await app.request('/session', { headers: { cookie: `sid=${cookie}` } })
    const sessionCookie = await getSetCookie(res, 'sid', decrypt)

    expect(refresh).toHaveBeenCalledWith({ sub })
    expect(res.status).toBe(500)
    expect(sessionCookie?.attributes).toStrictEqual({
      'Max-Age': '0',
      Path: '/',
      SameSite: 'Lax',
    })
    expect(sessionCookie?.value).toBeNull()
  })
})

describe('session.update()', () => {
  const app = new Hono().put('/session/:sub', useSession<TestData>({ secret }), async (c) => {
    await c.var.session.update({ sub: c.req.param('sub') })
    return c.json(c.var.session.data)
  })

  it('creates a new session with data', async () => {
    const res = await app.request(`/session/${sub}`, { method: 'PUT' })
    const sessionCookie = await getSetCookie(res, 'sid', decrypt)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toStrictEqual({ sub })
    expect(sessionCookie?.attributes).toStrictEqual({
      Path: '/',
      SameSite: 'Lax',
    })
    expect(sessionCookie?.payload.iat).toBeGreaterThan(recent)
    expect(sessionCookie?.payload.sid).not.toStrictEqual(sid)
    expect(sessionCookie?.payload.sub).toStrictEqual(sub)
  })

  it('updates the current session', async () => {
    const newSub = 'new-subject'
    const res = await app.request(`/session/${newSub}`, { method: 'PUT' })
    const sessionCookie = await getSetCookie(res, 'sid', decrypt)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toStrictEqual({ sub: newSub })
    expect(sessionCookie?.attributes).toStrictEqual({
      Path: '/',
      SameSite: 'Lax',
    })
    expect(sessionCookie?.payload).toStrictEqual({
      ...sessionCookie?.payload,
      sub: newSub,
    })
  })

  it('replaces an expired session', async () => {
    const newSub = 'new-subject'
    const expiredSession = { ...session.payload, exp: recent, iat: recent }
    const cookie = await encrypt(expiredSession)
    const res = await app.request(`/session/${newSub}`, {
      method: 'PUT',
      headers: { cookie: `sid=${cookie}` },
    })
    const sessionCookie = await getSetCookie(res, 'sid', decrypt)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toStrictEqual({ sub: newSub })
    expect(sessionCookie?.attributes).toStrictEqual({
      Path: '/',
      SameSite: 'Lax',
    })
    expect(sessionCookie?.payload.iat).toBeGreaterThan(expiredSession.iat)
    expect(sessionCookie?.payload.sid).not.toStrictEqual(expiredSession.sid)
    expect(sessionCookie?.payload.sub).toStrictEqual(newSub)
  })
})

describe('session.update(fn)', () => {
  const app = new Hono().put('/session/:sub', useSession<TestData>({ secret }), async (c) => {
    await c.var.session.update((data) => ({ ...data, sub: c.req.param('sub') }))
    return c.json(c.var.session.data)
  })

  it('creates a new session with data', async () => {
    const res = await app.request(`/session/${sub}`, { method: 'PUT' })
    const sessionCookie = await getSetCookie(res, 'sid', decrypt)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toStrictEqual({ sub })
    expect(sessionCookie?.attributes).toStrictEqual({
      Path: '/',
      SameSite: 'Lax',
    })
    expect(sessionCookie?.payload.iat).toBeGreaterThan(recent)
    expect(sessionCookie?.payload.sid).not.toStrictEqual(sid)
    expect(sessionCookie?.payload.sub).toStrictEqual(sub)
  })

  it('updates the current session', async () => {
    const newSub = 'new-subject'
    const cookie = await encrypt({ ...session.payload, aud: 'audience', iat: recent })
    const res = await app.request(`/session/${newSub}`, {
      method: 'PUT',
      headers: { cookie: `sid=${cookie}` },
    })
    const sessionCookie = await getSetCookie(res, 'sid', decrypt)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toStrictEqual({ aud: 'audience', sub: newSub })
    expect(sessionCookie?.attributes).toStrictEqual({
      Path: '/',
      SameSite: 'Lax',
    })
    expect(sessionCookie?.payload).toStrictEqual({
      ...session.payload,
      aud: 'audience',
      iat: recent,
      sub: newSub,
    })
  })
})

describe('session.delete()', () => {
  const app = new Hono().delete('/session', useSession<TestData>({ secret }), async (c) => {
    c.var.session.delete()
    return c.body(null, 204)
  })

  it('deletes the current session', async () => {
    const cookie = await encrypt(session.payload)
    const res = await app.request('/session', {
      method: 'DELETE',
      headers: { cookie: `sid=${cookie}` },
    })
    const sessionCookie = await getSetCookie(res, 'sid', decrypt)

    expect(res.status).toBe(204)
    expect(sessionCookie?.attributes).toStrictEqual({
      'Max-Age': '0',
      Path: '/',
      SameSite: 'Lax',
    })
    expect(sessionCookie?.value).toBeNull()
  })
})

describe('session.get() with storage', () => {
  const app = new Hono().get('/session', testSessionStorage, useSession({ secret }), async (c) => {
    const session = await c.var.session.get()
    return c.json(session)
  })

  it('creates a new session', async () => {
    const res = await app.request('/session')
    const sessionCookie = await getSetCookie(res, 'sid', decrypt)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toBeNull()
    expect(sessionCookie?.attributes).toStrictEqual({
      Path: '/',
      SameSite: 'Lax',
    })
    expect(sessionCookie?.payload.iat).toBeGreaterThan(recent)
    expect(sessionCookie?.payload.sid).not.toStrictEqual(sid)
    expect(storage.size).toBe(0)
  })

  it('creates a new session when the current session is not found', async () => {
    const getSpy = vi.spyOn(storage, 'get')
    const setSpy = vi.spyOn(storage, 'set')
    const cookie = await encrypt(session.payload)
    const res = await app.request('/session', { headers: { cookie: `sid=${cookie}` } })
    const sessionCookie = await getSetCookie(res, 'sid', decrypt)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toBeNull()
    expect(sessionCookie?.attributes).toStrictEqual({
      Path: '/',
      SameSite: 'Lax',
    })
    expect(sessionCookie?.payload.iat).toBeGreaterThan(recent)
    expect(sessionCookie?.payload.sid).not.toStrictEqual(sid)
    expect(getSpy).toHaveBeenCalledWith(sid)
    expect(setSpy).not.toBeCalled()
    expect(storage.size).toBe(0)
  })

  it('gets the current session', async () => {
    storage.set(sid, { sub })
    const cookie = await encrypt(session.payload)
    const res = await app.request('/session', { headers: { cookie: `sid=${cookie}` } })
    const sessionCookie = await getSetCookie(res, 'sid', decrypt)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toStrictEqual({ sub })
    expect(sessionCookie).toBeUndefined()
  })

  it('replaces an invalid session cookie', async () => {
    const res = await app.request('/session', { headers: { cookie: 'session;' } })
    const sessionCookie = await getSetCookie(res, 'sid', decrypt)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toBeNull()
    expect(sessionCookie?.attributes).toStrictEqual({
      Path: '/',
      SameSite: 'Lax',
    })
    expect(sessionCookie?.payload.iat).toBeGreaterThan(recent)
    expect(sessionCookie?.payload.sid).not.toStrictEqual(sid)
  })

  it('replaces an expired session', async () => {
    storage.set(sid, { sub })
    const expiredSession = { ...session.payload, exp: recent }
    const cookie = await encrypt(expiredSession)
    const res = await app.request('/session', { headers: { cookie: `sid=${cookie}` } })
    const sessionCookie = await getSetCookie(res, 'sid', decrypt)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toBeNull()
    expect(sessionCookie?.attributes).toStrictEqual({
      Path: '/',
      SameSite: 'Lax',
    })
    expect(sessionCookie?.payload.iat).toBeGreaterThan(recent)
    expect(sessionCookie?.payload.sid).not.toStrictEqual(sid)
    // Does not remove the expired session from the store
    expect(storage.size).toBe(1)
  })
})

describe('session.get(refresh) with storage', () => {
  const refresh = vi.fn<Refresh<TestData>>()

  const app = new Hono().get(
    '/session',
    testSessionStorage,
    useSession<TestData>({
      secret,
      duration: { absolute: offset * 3 },
    }),
    async (c) => {
      await c.var.session.get(refresh)
      return c.json(c.var.session.data)
    }
  )

  it('refreshes an expired session', async () => {
    refresh.mockImplementation((data) => Promise.resolve(data))
    storage.set(sid, { sub })
    const expiredSession = { ...session.payload, exp: recent, iat: recent }
    const cookie = await encrypt(expiredSession)
    const res = await app.request('/session', { headers: { cookie: `sid=${cookie}` } })
    const sessionCookie = await getSetCookie(res, 'sid', decrypt)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toStrictEqual({ sub })
    expect(sessionCookie?.attributes).toStrictEqual({
      'Max-Age': '7200',
      Path: '/',
      SameSite: 'Lax',
    })
    expect(sessionCookie?.payload.exp).toBeGreaterThan(expiredSession.exp)
    expect(sessionCookie?.payload.iat).toStrictEqual(expiredSession.iat)
    expect(sessionCookie?.payload.sid).toStrictEqual(expiredSession.sid)
    expect(storage.size).toBe(1)
  })

  it('replaces the session when refresh returns null', async () => {
    refresh.mockResolvedValue(null)
    storage.set(sid, { sub })
    const expiredSession = { ...session.payload, exp: recent, iat: recent }
    const cookie = await encrypt(expiredSession)
    const res = await app.request('/session', { headers: { cookie: `sid=${cookie}` } })
    const sessionCookie = await getSetCookie(res, 'sid', decrypt)
    const data = await res.json()

    expect(refresh).toHaveBeenCalledWith({ sub })
    expect(res.status).toBe(200)
    expect(data).toBeNull()
    expect(sessionCookie?.attributes).toStrictEqual({
      'Max-Age': '10800',
      Path: '/',
      SameSite: 'Lax',
    })
    expect(sessionCookie?.payload.exp).toBeGreaterThan(expiredSession.exp)
    expect(sessionCookie?.payload.iat).toBeGreaterThan(expiredSession.iat)
    expect(sessionCookie?.payload.sid).not.toStrictEqual(expiredSession.sid)
  })

  it('deletes the session when refresh fails', async () => {
    refresh.mockRejectedValue(new Error('Refresh failed'))
    storage.set(sid, { sub })
    const expiredSession = { ...session.payload, exp: recent }
    const cookie = await encrypt(expiredSession)
    const res = await app.request('/session', { headers: { cookie: `sid=${cookie}` } })
    const sessionCookie = await getSetCookie(res, 'sid', decrypt)

    expect(refresh).toHaveBeenCalledWith({ sub })
    expect(res.status).toBe(500)
    expect(sessionCookie?.attributes).toStrictEqual({
      'Max-Age': '0',
      Path: '/',
      SameSite: 'Lax',
    })
    expect(sessionCookie?.value).toBeNull()
  })
})

describe('session.update() with storage', () => {
  const app = new Hono().put(
    '/session/:sub',
    testSessionStorage,
    useSession({ secret }),
    async (c) => {
      await c.var.session.update({ sub: c.req.param('sub') })
      return c.json(c.var.session.data)
    }
  )

  it('creates a new session with data', async () => {
    const setSpy = vi.spyOn(storage, 'set')
    const res = await app.request(`/session/${sub}`, { method: 'PUT' })
    const sessionCookie = await getSetCookie(res, 'sid', decrypt)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toStrictEqual({ sub })
    expect(sessionCookie?.attributes).toStrictEqual({
      Path: '/',
      SameSite: 'Lax',
    })
    expect(sessionCookie?.payload.iat).toBeGreaterThan(recent)
    expect(sessionCookie?.payload.sid).not.toStrictEqual(sid)
    expect(setSpy).toHaveBeenCalledWith(expect.any(String), { sub })
    expect(storage.size).toBe(1)
    expect(storage.get(String(sessionCookie?.payload.sid))).toStrictEqual({ sub })
  })

  it('updates the current session', async () => {
    const newSub = 'new-subject'
    storage.set(sid, { sub })
    const cookie = await encrypt(session.payload)
    const res = await app.request(`/session/${newSub}`, {
      method: 'PUT',
      headers: { cookie: `sid=${cookie}` },
    })
    const sessionCookie = await getSetCookie(res, 'sid', decrypt)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toStrictEqual({ sub: newSub })
    expect(sessionCookie?.attributes).toStrictEqual({
      Path: '/',
      SameSite: 'Lax',
    })
    expect(storage.size).toBe(1)
    expect(storage.get(String(sessionCookie?.payload.sid))).toStrictEqual({ sub: newSub })
  })

  it('replaces an expired session', async () => {
    const newSub = 'new-subject'
    storage.set(sid, { sub })
    const expiredSession = { ...session.payload, exp: recent, iat: recent }
    const cookie = await encrypt(expiredSession)
    const res = await app.request(`/session/${newSub}`, {
      method: 'PUT',
      headers: { cookie: `sid=${cookie}` },
    })
    const sessionCookie = await getSetCookie(res, 'sid', decrypt)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toStrictEqual({ sub: newSub })
    expect(sessionCookie?.attributes).toStrictEqual({
      Path: '/',
      SameSite: 'Lax',
    })
    expect(sessionCookie?.payload.iat).toBeGreaterThan(expiredSession.iat)
    expect(sessionCookie?.payload.sid).not.toStrictEqual(expiredSession.sid)
    expect(storage.size).toBe(1)
    expect(storage.get(String(sessionCookie?.payload.sid))).toStrictEqual({ sub: newSub })
  })
})

describe('session.update(fn) with storage', () => {
  const app = new Hono().put(
    '/session/:sub',
    testSessionStorage,
    useSession({ secret }),
    async (c) => {
      await c.var.session.update((data) => ({ ...data, sub: c.req.param('sub') }))
      return c.json(c.var.session.data)
    }
  )

  it('creates a new session with data', async () => {
    const setSpy = vi.spyOn(storage, 'set')
    const res = await app.request(`/session/${sub}`, { method: 'PUT' })
    const sessionCookie = await getSetCookie(res, 'sid', decrypt)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toStrictEqual({ sub })
    expect(sessionCookie?.attributes).toStrictEqual({
      Path: '/',
      SameSite: 'Lax',
    })
    expect(sessionCookie?.payload.iat).toBeGreaterThan(recent)
    expect(sessionCookie?.payload.sid).not.toStrictEqual(sid)
    expect(setSpy).toHaveBeenCalledWith(expect.any(String), { sub })
    expect(storage.size).toBe(1)
    expect(storage.get(String(sessionCookie?.payload.sid))).toStrictEqual({ sub })
  })

  it('updates the current session', async () => {
    const newSub = 'new-subject'
    storage.set(sid, { aud: 'audience', sub })
    const cookie = await encrypt(session.payload)
    const res = await app.request(`/session/${newSub}`, {
      method: 'PUT',
      headers: { cookie: `sid=${cookie}` },
    })
    const sessionCookie = await getSetCookie(res, 'sid', decrypt)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toStrictEqual({ aud: 'audience', sub: newSub })
    expect(sessionCookie?.attributes).toStrictEqual({
      Path: '/',
      SameSite: 'Lax',
    })
    expect(storage.size).toBe(1)
    expect(storage.get(String(sessionCookie?.payload.sid))).toStrictEqual({
      aud: 'audience',
      sub: newSub,
    })
  })

  it('replaces an expired session', async () => {
    const newSub = 'new-subject'
    storage.set(sid, { sub })
    const expiredSession = { ...session.payload, exp: recent, iat: recent }
    const cookie = await encrypt(expiredSession)
    const res = await app.request(`/session/${newSub}`, {
      method: 'PUT',
      headers: { cookie: `sid=${cookie}` },
    })
    const sessionCookie = await getSetCookie(res, 'sid', decrypt)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toStrictEqual({ sub: newSub })
    expect(sessionCookie?.attributes).toStrictEqual({
      Path: '/',
      SameSite: 'Lax',
    })
    expect(sessionCookie?.payload.iat).toBeGreaterThan(expiredSession.iat)
    expect(sessionCookie?.payload.sid).not.toStrictEqual(expiredSession.sid)
    expect(storage.size).toBe(1)
    expect(storage.get(String(sessionCookie?.payload.sid))).toStrictEqual({ sub: newSub })
  })
})

describe('session.delete() with storage', () => {
  const app = new Hono().delete(
    '/session',
    testSessionStorage,
    useSession({ secret }),
    async (c) => {
      c.var.session.delete()
      return c.body(null, 204)
    }
  )

  it('deletes the current session', async () => {
    storage.set(sid, { sub })
    const cookie = await encrypt(session.payload)
    const res = await app.request('/session', {
      method: 'DELETE',
      headers: { cookie: `sid=${cookie}` },
    })
    const sessionCookie = await getSetCookie(res, 'sid', decrypt)

    expect(res.status).toBe(204)
    expect(sessionCookie?.attributes).toStrictEqual({
      'Max-Age': '0',
      Path: '/',
      SameSite: 'Lax',
    })
    expect(sessionCookie?.value).toBeNull()
    // Does not remove the expired session from the store
    expect(storage.size).toBe(1)
  })

  it('deletes an inavlid session cookie', async () => {
    const cookie = await encrypt({})
    const res = await app.request('/session', {
      method: 'DELETE',
      headers: { cookie: `sid=${cookie}` },
    })
    const sessionCookie = await getSetCookie(res, 'sid', decrypt)

    expect(res.status).toBe(204)
    expect(sessionCookie?.attributes).toStrictEqual({
      'Max-Age': '0',
      Path: '/',
      SameSite: 'Lax',
    })
    expect(sessionCookie?.value).toBeNull()
  })
})

describe('options.duration.absolute', () => {
  const refresh = vi.fn<Refresh<TestData>>()

  const app = new Hono().get(
    '/session',
    testSessionStorage,
    useSession<TestData>({
      secret,
      duration: { absolute: offset * 10 },
    }),
    async (c) => {
      const data = await c.var.session.get(refresh)
      return c.json(data)
    }
  )

  it('sets session expiry time and cookie Max-Age attribute', async () => {
    const res = await app.request('/session')
    const sessionCookie = await getSetCookie(res, 'sid', decrypt)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toBeNull()
    expect(sessionCookie?.attributes).toStrictEqual({
      'Max-Age': '36000',
      Path: '/',
      SameSite: 'Lax',
    })
    expect(sessionCookie?.payload.exp).toBeGreaterThan(recent)
    expect(sessionCookie?.payload.iat).toBeGreaterThan(recent)
    expect(sessionCookie?.payload.sid).not.toStrictEqual(sid)
  })

  it('updates the cookie Max-Age attribute when refreshing an expired session', async () => {
    const newSub = 'new-subject'
    refresh.mockResolvedValue({ sub: newSub })
    const expiredSession = { ...session.payload, exp: recent, iat: recent }
    storage.set(sid, { sub })
    const cookie = await encrypt(expiredSession)
    const res = await app.request('/session', { headers: { cookie: `sid=${cookie}` } })
    const sessionCookie = await getSetCookie(res, 'sid', decrypt)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toStrictEqual({ sub: newSub })
    expect(sessionCookie?.attributes).toMatchObject({
      'Max-Age': '32400',
      Path: '/',
      SameSite: 'Lax',
    })
    expect(sessionCookie?.payload.exp).toBeGreaterThan(expiredSession.exp)
    expect(sessionCookie?.payload.iat).toStrictEqual(expiredSession.iat)
    expect(sessionCookie?.payload.sid).toStrictEqual(expiredSession.sid)
  })
})

describe('options.duration.inactivity', () => {
  const refresh = vi.fn<Refresh<TestData>>()

  const app = new Hono().get(
    '/session',
    testSessionStorage,
    useSession<TestData>({
      secret,
      duration: { absolute: offset * 10, inactivity: offset * 3 },
    }),
    async (c) => {
      const data = await c.var.session.get(refresh)
      return c.json(data)
    }
  )

  it('sets session expiry time and cookie Max-Age attribute', async () => {
    const res = await app.request('/session')
    const sessionCookie = await getSetCookie(res, 'sid', decrypt)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toBeNull()
    expect(sessionCookie?.attributes).toStrictEqual({
      'Max-Age': '10800',
      Path: '/',
      SameSite: 'Lax',
    })
    expect(sessionCookie?.payload.exp).toBeGreaterThan(recent)
    expect(sessionCookie?.payload.iat).toBeGreaterThan(recent)
    expect(sessionCookie?.payload.sid).not.toStrictEqual(sid)
  })

  it('refreshes an expired session', async () => {
    const newSub = 'new-subject'
    refresh.mockResolvedValue({ sub: newSub })
    const expiredSession = { ...session.payload, exp: recent, iat: recent }
    storage.set(sid, { sub })
    const cookie = await encrypt(expiredSession)
    const res = await app.request('/session', { headers: { cookie: `sid=${cookie}` } })
    const sessionCookie = await getSetCookie(res, 'sid', decrypt)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toStrictEqual({ sub: newSub })
    expect(sessionCookie?.attributes).toMatchObject({
      'Max-Age': '10800',
      Path: '/',
      SameSite: 'Lax',
    })
    expect(sessionCookie?.payload.exp).toBeGreaterThan(expiredSession.exp)
    expect(sessionCookie?.payload.iat).toStrictEqual(expiredSession.iat)
    expect(sessionCookie?.payload.sid).toStrictEqual(expiredSession.sid)
  })
})

describe('options.secret', () => {
  const app = new Hono()
    .get(
      '/encryption-key',
      useSession<TestData>({
        secret: encryptionKey,
      }),
      async (c) => {
        const data = await c.var.session.get()
        return c.json(data)
      }
    )
    .get('/missing-secret', useSession<TestData>({}), async (c) => {
      const data = await c.var.session.get()
      return c.json(data)
    })

  it('accepts an encryption key', async () => {
    const cookie = await encrypt({ ...session.payload, sub })

    const res = await app.request('/encryption-key', { headers: { cookie: `sid=${cookie}` } })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toStrictEqual({ sub })
  })

  it('throws an error when undefined', async () => {
    const res = await app.request('/missing-secret', {}, { AUTH_SECRET: undefined })
    const sessionCookie = await getSetCookie(res, 'sid', decrypt)

    expect(res.status).toBe(500)
    expect(sessionCookie).toBeUndefined()
  })
})

describe('session events', () => {
  const onCreate = vi.fn()
  const onDelete = vi.fn()
  const onRefresh = vi.fn()
  const onUpdate = vi.fn()

  const refresh = vi.fn<Refresh<TestData>>()

  const sessionEvents = useSession<TestData>({
    secret,
    onCreate,
    onDelete,
    onRefresh,
    onUpdate,
  })

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
    const cookie = await encrypt({ ...session.payload, sub })
    await app.request('/session', { method: 'DELETE', headers: { cookie: `sid=${cookie}` } })

    expect(refresh).not.toHaveBeenCalled()
    expect(onCreate).not.toHaveBeenCalled()
    expect(onUpdate).not.toHaveBeenCalled()
    expect(onRefresh).not.toHaveBeenCalled()
    expect(onDelete).toHaveBeenCalledWith({ sub })
  })

  it('emits refresh events', async () => {
    const newSub = 'new-subject'
    refresh.mockResolvedValue({ sub: newSub })

    const cookie = await encrypt({ ...session.payload, exp: recent, sub })
    await app.request('/session', { headers: { cookie: `sid=${cookie}` } })

    expect(refresh).toHaveBeenCalledWith({ sub })
    expect(onCreate).not.toHaveBeenCalled()
    expect(onUpdate).not.toHaveBeenCalled()
    expect(onRefresh).toHaveBeenCalledWith({ sub: newSub })
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('emits update events', async () => {
    const cookie = await encrypt(session.payload)
    await app.request(`/session/${sub}`, { method: 'PUT', headers: { cookie: `sid=${cookie}` } })

    expect(refresh).not.toHaveBeenCalled()
    expect(onCreate).not.toHaveBeenCalled()
    expect(onDelete).not.toHaveBeenCalled()
    expect(onRefresh).not.toHaveBeenCalled()
    expect(onUpdate).toHaveBeenCalledWith({ sub })
  })
})
