import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test'
import { createTestSession } from '../src/helper/testing'
import { app, secret } from './cloudflare-kv'

const { soon, recent, encrypt, sid, sub } = createTestSession({ secret })

describe('Cloudflare KV adapter', () => {
  it('gets session data', async () => {
    const ctx = createExecutionContext()
    await env.SESSION_KV.put(sid, JSON.stringify({ sub }))
    const cookie = await encrypt({ iat: recent, exp: soon, sid })

    const res = await app.request(
      '/session',
      {
        headers: { cookie: `sid=${cookie}` },
      },
      env,
      ctx
    )
    await waitOnExecutionContext(ctx)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toStrictEqual({ sub })
  })

  it('updates session data', async () => {
    const ctx = createExecutionContext()
    await env.SESSION_KV.put(sid, JSON.stringify({ sub }))
    const newSub = 'new-subject'
    const cookie = await encrypt({ iat: recent, exp: soon, sid })
    const res = await app.request(
      '/session',
      {
        body: JSON.stringify({ sub: newSub }),
        headers: { cookie: `sid=${cookie}` },
        method: 'PUT',
      },
      env,
      ctx
    )
    await waitOnExecutionContext(ctx)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toStrictEqual({ sub: newSub })
    await expect(env.SESSION_KV.get(sid, 'json')).resolves.toStrictEqual({ sub: newSub })
  })

  it('deletes session data', async () => {
    const ctx = createExecutionContext()
    await env.SESSION_KV.put(sid, JSON.stringify({ sub }))
    const cookie = await encrypt({ iat: recent, exp: soon, sid })
    const res = await app.request(
      '/session',
      {
        headers: { cookie: `sid=${cookie}` },
        method: 'DELETE',
      },
      env,
      ctx
    )
    await waitOnExecutionContext(ctx)

    expect(res.status).toBe(204)
    await expect(env.SESSION_KV.get(sid, 'json')).resolves.toBeNull()
  })
})
