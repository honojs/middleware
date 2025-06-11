import { parse } from 'hono/utils/cookie'
import * as jose from 'jose'
import * as cookies from '../../cookies'
import type { SessionCookie } from '../../session'

export interface TestSessionInit {
  /** Time since unix epoch in seconds */
  now: number

  /** Static offset to derive relative times */
  offset: number

  /** Time in the recent past */
  recent: number

  /** Time in the near future */
  soon: number

  /** Session id */
  sid: string

  /** Subject of the session */
  sub: string

  /** Secret used to derive encryption key */
  secret: string

  /** A SessionInit object */
  session: SessionInit
}

interface SessionInit {
  name?: string
  payload: SessionCookie
}

interface SessionRequestInit extends RequestInit {
  session?: SessionInit
}

export type GetCookieResult<Value> = {
  attributes: Record<string, string>
  name: string
  value: string | null
  payload: Value
}

export interface TestSession extends TestSessionInit {
  /**
   * Add a cookie to the request headers.
   */
  addCookie: (headers: Headers, name: string, value: string) => void
  /**
   * Decrypt a JWT value using the encryption key.
   */
  decrypt: (value: string, options?: jose.JWTDecryptOptions) => Promise<cookies.CookiePayload>
  /**
   * Encrypt a cookie payload as a JWT string.
   */
  encrypt: (payload: cookies.CookiePayload) => Promise<string>
  /**
   * Parse the response set-cookie headers to find a cookie by name or prefix.
   *
   * @returns the parsed cookie attributes, matched name, and decrypted value.
   */
  getCookie: <Value>(
    res: Response,
    nameOrPrefix: string,
    decrypt: (value: string) => Promise<Value>
  ) => Promise<GetCookieResult<Value> | undefined>
  /**
   * Create an encryption key from the secret,
   * or return the cached key if it exists.
   */
  getEncryptionKey: () => Promise<cookies.EncryptionKey>
  /**
   * Create a request with an optional session cookie.
   */
  sessionRequest: (input?: RequestInfo | URL, init?: SessionRequestInit) => Promise<Request>
}

/**
 * Create a test session context with default values.
 */
export function createTestSession(init: Partial<TestSessionInit> = {}): TestSession {
  const {
    now = cookies.epoch(),
    offset = 3_600, // 1 hour in seconds
    recent = Math.round(now - offset),
    secret = cookies.generateId(16),
    sid = 'some-session-id',
    soon = Math.round(now + offset),
    session = { name: 'sid', payload: { sid } },
    sub = 'some-subject',
  } = init
  let encryptionKey: cookies.EncryptionKey | undefined

  return {
    addCookie,
    decrypt,
    encrypt,
    getCookie,
    getEncryptionKey,
    now,
    offset,
    recent,
    secret,
    session,
    sessionRequest,
    sid,
    soon,
    sub,
  }

  async function decrypt(value: string, options?: jose.JWTDecryptOptions) {
    encryptionKey ??= await getEncryptionKey()
    const result = await jose.jwtDecrypt(value, encryptionKey, options)
    return result.payload
  }

  async function encrypt(payload: cookies.CookiePayload) {
    encryptionKey ??= await getEncryptionKey()
    const jwt = new jose.EncryptJWT(payload)
      .setIssuedAt(payload.iat ?? now)
      .setProtectedHeader({ enc: 'A256GCM', alg: 'dir' })

    return jwt.encrypt(encryptionKey)
  }

  async function getCookie<Value>(
    res: Response,
    nameOrPrefix: string,
    decryptFn: (value: string) => Promise<Value>
  ): Promise<GetCookieResult<Value> | undefined> {
    let found

    for (const value of res.headers.getSetCookie()) {
      if (!found?.name) {
        found = parseCookie(value)
      }
    }

    if (found?.name) {
      const { name, cookie } = found
      const { [name]: value, ...attributes } = cookie

      if (value !== '') {
        return {
          attributes,
          name,
          value,
          payload: await decryptFn(value),
        }
      }

      return {
        attributes,
        name,
        value: null,
        get payload(): Value {
          throw new Error(`Cookie "${name}" value is empty.`)
        },
      }
    }

    return

    function parseCookie(cookie: string) {
      const entries: [string, string][] = []
      let name

      for (const [key, value] of Object.entries(parse(cookie))) {
        if (key.includes(nameOrPrefix)) {
          name = key
        }

        entries.push([key, value])
      }

      return { name, cookie: Object.fromEntries(entries) }
    }
  }

  async function getEncryptionKey() {
    encryptionKey ??= await cookies.createEncryptionKey(secret)
    return encryptionKey
  }

  async function sessionRequest(
    input: RequestInfo | URL = '/session',
    { headers, session, ...init }: SessionRequestInit = {}
  ) {
    if (!(headers instanceof Headers)) {
      headers = new Headers(headers)
    }

    if (session) {
      const { name, payload: value } = session
      addCookie(headers, name ?? 'sid', await encrypt(value))
    }

    if (typeof input === 'string') {
      input = new URL(input, 'http://localhost')
    }

    return new Request(input, { ...init, headers })
  }

  function addCookie(headers: Headers, name: string, value: string) {
    const cookie = headers.get('cookie')

    if (cookie) {
      headers.set('cookie', `${cookie}; ${name}=${value}`)
    } else {
      headers.set('cookie', `${name}=${value}`)
    }
  }
}
