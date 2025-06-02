import { parse } from 'hono/utils/cookie'
import * as jose from 'jose'
import * as cookies from '../../cookies'

interface SessionCookie extends cookies.CookiePayload {
  sid: string
  iat: number
  exp: number
}

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

  /** Session cookie payload */
  sessionCookie: SessionCookie
}

type GetCookieResult<Value> =
  | {
      name: string
      cookie: Record<string, string | Value | null>
    }
  | {
      name: string
      cookie: null
    }

export interface TestSession extends TestSessionInit {
  /**
   * Decrypt a JWT value using the encryption key.
   */
  decrypt: (
    value: string,
    options?: jose.JWTDecryptOptions
  ) => Promise<cookies.CookiePayload | null>
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
  ) => Promise<GetCookieResult<Value>>
  /**
   * Create an encryption key from the secret,
   * or return the cached key if it exists.
   */
  getEncryptionKey: () => Promise<cookies.EncryptionKey>
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
    sub = 'some-subject',
    sessionCookie = { iat: recent, exp: soon, sid },
  } = init
  let encryptionKey: cookies.EncryptionKey | undefined

  return {
    decrypt,
    encrypt,
    getCookie,
    getEncryptionKey,
    now,
    offset,
    recent,
    secret,
    sessionCookie,
    sid,
    soon,
    sub,
  }

  async function decrypt(value: string, options?: jose.JWTDecryptOptions) {
    const key = await getEncryptionKey()
    const result = await jose.jwtDecrypt(value, key, options)
    return result.payload
  }

  async function encrypt(payload: cookies.CookiePayload) {
    const key = await getEncryptionKey()
    const jwt = new jose.EncryptJWT(payload)
      .setIssuedAt(payload.iat ?? now)
      .setProtectedHeader({ enc: 'A256GCM', alg: 'dir' })

    return jwt.encrypt(key)
  }

  async function getCookie<Value>(
    res: Response,
    nameOrPrefix: string,
    decryptFn: (value: string) => Promise<Value>
  ): Promise<GetCookieResult<Value>> {
    let found

    for (const value of res.headers.getSetCookie()) {
      if (!found?.name) {
        found = parseCookie(value)
      }
    }

    if (found?.name) {
      const { name, cookie } = found
      const value = cookie[name] ? await decryptFn(cookie[name]) : null
      return { name, cookie: { ...cookie, [name]: value } }
    }

    return { name: nameOrPrefix, cookie: null }

    function parseCookie(cookie: string) {
      const entries = []
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
}
