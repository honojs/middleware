import type * as jose from 'jose'
import type * as cookies from './cookies'
import type { Storage } from '.'

export interface SessionCookie extends cookies.CookiePayload {
  sid?: string
}

export type SessionData = Record<string, unknown>

/**
 * Function to refresh the session data.
 *
 * If the refresh function returns null, the session will be destroyed.
 */
export type Refresh<Data> = (expired: Data) => Promise<Data | null>

/**
 * Function to update previous session data.
 */
type Update<Data> = (prevData: Data | null) => Data

export interface Session<Data> {
  /**
   * Current session data.
   */
  readonly data: Data | null

  /**
   * Delete the current session, removing the session cookie and data from storage.
   */
  delete: () => void

  /**
   * Get the current session data, optionally calling the provided refresh function.
   */
  get: (refresh?: Refresh<Data>) => Promise<Data | null>

  /**
   * Update the current session with the provided session data.
   */
  update: (data: Data | Update<Data>) => Promise<void>
}

/** Indicates that the current session should be destroyed */
interface DeleteSession<Data> {
  action: 'destroy'
  data: Data | null
  payload?: SessionCookie | null
}

/** Indicates that the current session has been initialised */
interface InitialisedSession<Data> {
  action: 'initialised'
  data: Data
  payload: SessionCookie
}

/** Indicates that the current session should be updated */
interface UpdateSession<Data> {
  action: 'update'
  data: Data | null
  payload: SessionCookie
}

export type SessionResult<Data> =
  | InitialisedSession<Data>
  | UpdateSession<Data>
  | DeleteSession<Data>

interface SessionStore<Data> extends Session<Data> {
  /**
   * Store any changes to the session data and update the session cookie.
   */
  persist: () => Promise<void>
}

type SessionEvent<Data> = (data: Data | null) => void

export interface SessionEvents<Data> {
  onCreate?: SessionEvent<Data> | undefined
  onDelete?: SessionEvent<Data> | undefined
  onRefresh?: SessionEvent<Data> | undefined
  onUpdate?: SessionEvent<Data> | undefined
}

interface CreateSessionOptions<Data> extends SessionEvents<Data> {
  cookie: {
    decrypt(
      jwt: string,
      options?: jose.JWTDecryptOptions
    ): Promise<cookies.DecryptResult<SessionCookie>>
    delete(): void
    encrypt(payload: SessionCookie): Promise<{ jwe: string; maxAge?: number | undefined }>
    get(): string | undefined
    set(value: string, maxAge?: number): void
  }
  generateId: () => string
  storage?: Storage<Data> | undefined
}

export function getSession<Data extends SessionData>({
  onCreate,
  onDelete,
  onRefresh,
  onUpdate,
  cookie,
  storage,
  generateId,
}: CreateSessionOptions<Data>): SessionStore<Data> {
  let session: SessionResult<Data> | null = null

  return {
    get data() {
      if (!session) {
        throw new Error('Session not initialised. Call get() or update() first.')
      }

      if (session.action === 'destroy') {
        throw new Error('Session has been destroyed.')
      }

      return session.data ?? null
    },
    delete() {
      if (session) {
        onDelete?.(session.data)
        session = { ...session, action: 'destroy' }
      } else {
        session = deleteSession()
      }
    },
    async get(refresh) {
      const cookieResult = await getSessionCookie()

      session = await getSession(cookieResult, async (expired) => {
        let refreshed = null

        try {
          if (refresh) {
            refreshed = await refresh(expired)
          }
        } finally {
          if (!refreshed) {
            const payload = cookieResult?.expired?.payload ?? cookieResult?.payload
            session = deleteSession(payload)
          }

          onRefresh?.(refreshed)
        }

        return refreshed
      })

      return session.data
    },
    persist() {
      return persistSession()
    },
    async update(data) {
      const cookieResult = await getSessionCookie()
      const updateFn = typeof data === 'function' ? data : () => data

      if (cookieResult && !cookieResult.expired) {
        session = await getSession(cookieResult)
        session = updateSession(updateFn(session.data), session.payload)
        onUpdate?.(session.data)
      } else {
        const oldPayload = cookieResult?.expired?.payload ?? cookieResult?.payload
        session = createSession(updateFn(null), oldPayload)
        onCreate?.(session.data)
      }
    },
  }

  function createSession(data: Data, oldPayload?: cookies.CookiePayload): UpdateSession<Data> {
    // Remove the old session data from storage if it exists
    if (typeof oldPayload?.sid === 'string') {
      storage?.delete(oldPayload.sid)
    }

    return updateSession(data)
  }

  function deleteSession(payload: SessionCookie | null = null): DeleteSession<Data> {
    return { action: 'destroy', data: null, payload }
  }

  async function getSession(
    result?: cookies.DecryptResult<SessionCookie>,
    refresh?: Refresh<Data>
  ): Promise<UpdateSession<Data> | InitialisedSession<Data>> {
    let data = null
    let payload = result?.expired?.payload ?? result?.payload ?? null

    // Extract session data from the cookie payload
    if (payload) {
      data = await getSessionData(payload)
    }

    // Create a new session when there is no existing session
    if (!data || !payload) {
      payload = createCookie()
      return { action: 'update', payload, data }
    }

    // Return the existing session if it has not expired
    // or the refresh function was not provided
    if (!result?.expired || refresh === undefined) {
      return { action: 'initialised', payload, data }
    }

    // Attempt to refresh the session if it has expired
    data = await refresh(data)

    if (data) {
      // Reset session expiry when session is refreshed
      payload.exp = undefined
    } else {
      // Create a new session when refresh returns null
      payload = createCookie()
    }

    // Merge session data with the stateless session cookie
    if (!storage) {
      const cookie = getStatelessCookie(payload, data)
      payload = { ...cookie.payload, ...cookie.data }
    }

    return { action: 'update', payload, data }
  }

  /**
   * Persist the current session data to storage and update the session cookie.
   */
  async function persistSession(): Promise<void> {
    if (session?.action === 'update') {
      if (session.payload.sid && session.data) {
        storage?.set(session.payload.sid, session.data)
      }

      if (!storage || session.payload.exp === undefined) {
        const { jwe, maxAge } = await cookie.encrypt(session.payload)
        cookie.set(jwe, maxAge)
      }
    }

    if (session?.action === 'destroy') {
      if (session.payload?.sid) {
        storage?.delete(session.payload.sid)
      }

      cookie.delete()
    }
  }

  /**
   * Update the session with new session data.
   *
   * Optionally merges session data with a stateless session cookie.
   */
  function updateSession(data: Data, payload?: cookies.CookiePayload): UpdateSession<Data> {
    payload ??= createCookie(data)

    if (!storage) {
      const cookie = getStatelessCookie(payload, data)
      payload = { ...cookie.payload, ...cookie.data }
    }

    return { action: 'update', payload, data }
  }

  /**
   * Create a session cookie with a new session id.
   *
   * Optionally merges session data with a stateless session cookie.
   */
  function createCookie(init?: SessionData): SessionCookie {
    // Always generate a new session id to avoid session fixation attacks
    const payload = { sid: generateId() }

    if (storage) {
      return payload
    }

    const cookie = getStatelessCookie(payload, init)
    return { ...cookie.payload, ...cookie.data }
  }

  /**
   * Get the session cookie and decrypt it if it exists.
   */
  async function getSessionCookie(): Promise<cookies.DecryptResult<SessionCookie> | undefined> {
    const value = cookie.get()
    let result

    if (value) {
      result = await cookie.decrypt(value, {
        requiredClaims: ['sid'],
      })
    }

    return result
  }

  /**
   * Extract session data from a stateless session cookie.
   *
   * Session data includes all keys except for the `exp`, `iat`, and `sid` claims.
   */
  function getSessionData(payload: SessionCookie) {
    if (storage && typeof payload.sid === 'string') {
      return storage.get(payload.sid)
    }

    const { data } = getStatelessCookie(payload)
    return data as Data
  }
}

/**
 * Shallow merge session data with the session cookie,
 * ensuring that the original `exp`, `iat`, and `sid` claims are preserved.
 */
function getStatelessCookie(payload: SessionCookie, data?: SessionData | null) {
  const { exp, iat, sid, ...rest } = payload
  return { payload: { exp, iat, sid }, data: { ...rest, ...data } }
}
