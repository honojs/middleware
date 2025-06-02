import type { Context, Env } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'
import type { CookieOptions } from 'hono/utils/cookie'
import * as cookies from './cookies'
import { getSession } from './session'
import type { Session, SessionData, SessionEvents } from './session'

export type { Session, SessionCookie, SessionData } from './session'

export interface Storage<Data> {
  delete(sid: string): void
  get(sid: string): Promise<Data | null> | Data | null
  set(sid: string, value: Data): void
}

const DEFAULT_SESSION_NAME = 'sid'

export interface SessionOptions<Data> extends SessionEvents<Data> {
  /**
   * Function to generate a unique session ID
   */
  generateId?: () => string

  /**
   * 32-byte, hex-encoded string, or encryption key object, used to encrypt the session cookie.
   *
   * @default process.env.AUTH_SECRET
   */
  secret?: string | cookies.EncryptionKey

  /**
   * Session cookie options
   */
  sessionCookie?: SessionCookieOptions | undefined
}

interface SessionCookieOptions {
  /**
   * The maximum age duration of the session cookie.
   *
   * By default, no maximum age is set
   */
  duration?: cookies.MaxAgeDuration

  /**
   * The name of the session cookie.
   *
   * @default 'sid'
   */
  name?: string

  /**
   * Session cookie options
   */
  options?: CookieOptions
}

type SessionEnv<Data> = Env & {
  Bindings: {
    AUTH_SECRET?: string
  }
  Variables: {
    session: Session<Data>
    sessionStorage?: Storage<Data>
  }
}

export const session = <Data extends SessionData>(options?: SessionOptions<Data>) => {
  const generateId = options?.generateId ?? cookies.generateId
  const sessionCookie = options?.sessionCookie
  const sessionCookieName = sessionCookie?.name ?? DEFAULT_SESSION_NAME
  let encryptionKey: cookies.EncryptionKey | undefined

  return createMiddleware<SessionEnv<Data>>(async (c, next) => {
    const secret = options?.secret ?? c.env.AUTH_SECRET

    if (!secret) {
      throw new Error('Missing AUTH_SECRET')
    }

    const session = getSession({
      cookie: {
        name: sessionCookieName,
        options: {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          ...sessionCookie?.options,
        },
        async decrypt(jwt, options) {
          encryptionKey ??= await cookies.createEncryptionKey(secret)
          return cookies.jweDecrypt(jwt, encryptionKey, options)
        },
        delete(name, options) {
          deleteCookie(c, name, options)
        },
        async encrypt(payload) {
          encryptionKey ??= await cookies.createEncryptionKey(secret)
          return cookies.jweEncrypt(payload, encryptionKey, sessionCookie?.duration)
        },
        get(name, prefix) {
          return getCookie(c, name, prefix)
        },
        set(name, value, options) {
          setCookie(c, name, value, options)
        },
      },
      generateId,
      onCreate: options?.onCreate,
      onDelete: options?.onDelete,
      onRefresh: options?.onRefresh,
      onUpdate: options?.onUpdate,
      storage: c.var.sessionStorage,
    })

    c.set('session', {
      get data() {
        return session.data
      },
      delete() {
        session.delete()
      },
      get(refresh) {
        return session.get(refresh)
      },
      async update(data) {
        await session.update(data)
      },
    })

    try {
      await next()
    } finally {
      await session.persist()
    }
  })
}

type SessionStorageEnv<Data> = Env & {
  Variables: {
    sessionStorage?: Storage<Data>
  }
}

type Set<E extends Env, Storage> = Storage | ((c: Context<E>) => Storage)

export const sessionStorage = <Data, E extends SessionStorageEnv<Data>>(
  set: Set<E, Storage<Data>>
) =>
  createMiddleware<E>((c, next) => {
    c.set('sessionStorage', typeof set === 'function' ? set(c) : set)
    return next()
  })
