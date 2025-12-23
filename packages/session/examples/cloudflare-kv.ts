import { env } from 'cloudflare:workers'
import { Hono } from 'hono'
import type { SessionEnv } from '../src'
import { useSession, useSessionStorage } from '../src'
import * as cookies from '../src/cookies'

export const secret = cookies.generateId(16)

/**
 * Example hono app using Cloudflare KV as session storage.
 *
 * This example assumes you have a Cloudflare KV namespace named `SESSION_KV`.
 */
export const app = new Hono<SessionEnv>()

app.use(
  useSessionStorage((c) => ({
    delete(sid) {
      c.executionCtx.waitUntil(env.SESSION_KV.delete(sid))
    },
    get(sid) {
      return env.SESSION_KV.get(sid, 'json')
    },
    set(sid, data) {
      c.executionCtx.waitUntil(
        env.SESSION_KV.put(sid, JSON.stringify(data), {
          // Optionally configure session data to expire some time after the session cookie expires.
          expirationTtl: 2_592_000, // 30 days in seconds
        })
      )
    },
  })),
  useSession({ secret })
)

app.get('/session', async (c) => {
  const data = await c.var.session.get()
  return c.json(data)
})

app.put('/session', async (c) => {
  const data = await c.req.json()
  await c.var.session.update(data)
  return c.json(c.var.session.data)
})

app.delete('/session', async (c) => {
  await c.var.session.get()
  c.var.session.delete()
  return c.body(null, 204)
})
