import type { Context, Env, MiddlewareHandler } from 'hono'
import * as cookie from 'hono/cookie'
import { createMiddleware } from 'hono/factory'
import type { CookieOptions } from 'hono/utils/cookie'
import type { EncryptionKey, MaxAgeDuration } from './cookies'
import { createEncryptionKey, generateId, jweDecrypt, jweEncrypt } from './cookies'
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
   * The maximum age duration of the session cookie.
   *
   * By default, no maximum age is set
   */
  duration?: MaxAgeDuration

  /**
   * Function to generate a unique session ID
   */
  generateId?: () => string

  /**
   * 32-byte, hex-encoded string, or encryption key object, used to encrypt the session cookie.
   *
   * @default process.env.AUTH_SECRET
   */
  secret?: string | EncryptionKey

  deleteCookie?: (c: Context, name: string, opt?: CookieOptions) => void
  getCookie?: (c: Context, name: string) => string | undefined
  setCookie?: (c: Context, name: string, value: string, opt?: CookieOptions) => void
}

export type SessionEnv<Data = SessionData> = Env & {
  Bindings: {
    AUTH_SECRET?: string
  }
  Variables: {
    session: Session<Data>
    sessionStorage?: Storage<Data>
  }
}

export const useSession = <Data extends SessionData>(
  options?: SessionOptions<Data>
): MiddlewareHandler<SessionEnv<Data>> => {
  const deleteCookie = options?.deleteCookie ?? cookie.deleteCookie
  const getCookie = options?.getCookie ?? cookie.getCookie
  const setCookie = options?.setCookie ?? cookie.setCookie
  const sessionCookieOptions: CookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  }
  let encryptionKey: EncryptionKey | undefined

  return createMiddleware<SessionEnv<Data>>(async (c, next) => {
    const secret = options?.secret ?? c.env.AUTH_SECRET

    if (!secret) {
      throw new Error('Missing AUTH_SECRET')
    }

    const session = getSession({
      cookie: {
        async decrypt(jwt, options) {
          encryptionKey ??= await createEncryptionKey(secret)
          return jweDecrypt(jwt, encryptionKey, options)
        },
        delete() {
          deleteCookie(c, DEFAULT_SESSION_NAME, sessionCookieOptions)
        },
        async encrypt(payload) {
          encryptionKey ??= await createEncryptionKey(secret)
          return jweEncrypt(payload, encryptionKey, options?.duration)
        },
        get() {
          return getCookie(c, DEFAULT_SESSION_NAME)
        },
        set(value, maxAge) {
          setCookie(c, DEFAULT_SESSION_NAME, value, { ...sessionCookieOptions, maxAge })
        },
      },
      generateId: options?.generateId ?? generateId,
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

export const useSessionStorage = <Data, E extends SessionStorageEnv<Data>>(
  set: Set<E, Storage<Data>>
): MiddlewareHandler<E> =>
  createMiddleware<E>((c, next) => {
    c.set('sessionStorage', typeof set === 'function' ? set(c) : set)
    return next()
  })
