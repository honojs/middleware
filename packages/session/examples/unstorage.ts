import { Hono } from 'hono'
import { createStorage } from 'unstorage'
import type { SessionData, SessionEnv } from '../src'
import { useSession, useSessionStorage } from '../src'
import * as cookies from '../src/cookies'

interface StorageData extends SessionData {
  sub: string
}

export const storage = createStorage<StorageData>()

export const secret = cookies.generateId(16)

/**
 * Example hono app using Unstorage as session storage.
 *
 * @see {@link https://unstorage.unjs.io/}
 */
export const app = new Hono<SessionEnv<StorageData>>().use(
  useSessionStorage({
    delete(sid) {
      storage.remove(sid)
    },
    get(sid) {
      return storage.get(sid)
    },
    set(sid, data) {
      storage.set(sid, data)
    },
  }),
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
