import type { Credential, KeyStorer } from 'firebase-auth-cloudflare-workers'
import { AdminAuthApiClient, Auth, WorkersKVStoreSingle } from 'firebase-auth-cloudflare-workers'
import type { GoogleOAuthAccessToken } from 'firebase-auth-cloudflare-workers/dist/main/credential'
import { Hono } from 'hono'
import { setCookie } from 'hono/cookie'
import { HTTPException } from 'hono/http-exception'
import { Miniflare } from 'miniflare'
import { describe, it, expect, beforeAll, vi } from 'vitest'
import type { VerifyFirebaseAuthEnv } from '../src'
import { verifyFirebaseAuth, getFirebaseToken, verifySessionCookieFirebaseAuth } from '../src'

describe('verifyFirebaseAuth middleware', () => {
  const emulatorHost = '127.0.0.1:9099'
  const validProjectId = 'example-project12345' // see package.json

  const nullScript = 'export default { fetch: () => new Response(null, { status: 404 }) };'
  const mf = new Miniflare({
    modules: true,
    script: nullScript,
    kvNamespaces: ['PUBLIC_JWK_CACHE_KV'],
  })

  let user: signUpResponse

  beforeAll(async () => {
    await deleteAccountEmulator(emulatorHost, validProjectId)

    user = await signUpEmulator(emulatorHost, {
      email: 'codehex@hono.js',
      password: 'honojs',
    })

    await sleep(1000) // wait for iat
  })

  describe('service worker syntax', () => {
    it('valid case, should be 200', async () => {
      const app = new Hono()

      resetAuth()

      // This is assumed to be obtained from an environment variable.
      const PUBLIC_JWK_CACHE_KEY = 'testing-cache-key'
      const PUBLIC_JWK_CACHE_KV = (await mf.getKVNamespace(
        'PUBLIC_JWK_CACHE_KV'
      )) as unknown as KVNamespace

      app.use(
        '*',
        verifyFirebaseAuth({
          projectId: validProjectId,
          keyStore: WorkersKVStoreSingle.getOrInitialize(PUBLIC_JWK_CACHE_KEY, PUBLIC_JWK_CACHE_KV),
          disableErrorLog: true,
          firebaseEmulatorHost: emulatorHost,
        })
      )
      app.get('/hello', (c) => c.json(getFirebaseToken(c)))

      const req = new Request('http://localhost/hello', {
        headers: {
          Authorization: `Bearer ${user.idToken}`,
        },
      })

      const res = await app.request(req)

      expect(res).not.toBeNull()
      expect(res.status).toBe(200)

      const json = await res.json<{ aud: string; email: string }>()
      expect(json.aud).toBe(validProjectId)
      expect(json.email).toBe('codehex@hono.js')
    })
  })

  describe('module worker syntax', () => {
    it.each([
      [
        'valid case, should be 200',
        {
          headerKey: 'Authorization',
          config: {
            projectId: validProjectId,
          },
          wantStatus: 200,
        },
      ],
      [
        'valid specified headerKey, should be 200',
        {
          headerKey: 'X-Authorization',
          config: {
            projectId: validProjectId,
            authorizationHeaderKey: 'X-Authorization',
          },
          wantStatus: 200,
        },
      ],
      [
        'invalid authorization header, should be 400',
        {
          headerKey: 'X-Authorization',
          config: {
            projectId: validProjectId, // see package.json
            // No specified header key.
          },
          wantStatus: 400,
        },
      ],
      [
        'invalid project ID, should be 401',
        {
          headerKey: 'Authorization',
          config: {
            projectId: 'invalid-projectId',
          },
          wantStatus: 401,
        },
      ],
    ])('%s', async (_, { headerKey, config, wantStatus }) => {
      const app = new Hono<{ Bindings: VerifyFirebaseAuthEnv }>()

      resetAuth()

      const PUBLIC_JWK_CACHE_KV = (await mf.getKVNamespace(
        'PUBLIC_JWK_CACHE_KV'
      )) as unknown as KVNamespace
      const env: VerifyFirebaseAuthEnv = {
        FIREBASE_AUTH_EMULATOR_HOST: 'localhost:9099',
        PUBLIC_JWK_CACHE_KEY: 'testing-cache-key',
        PUBLIC_JWK_CACHE_KV,
      }

      app.use(
        '*',
        verifyFirebaseAuth({
          ...config,
          disableErrorLog: true,
        })
      )
      app.get('/hello', (c) => c.text('OK'))

      const req = new Request('http://localhost/hello', {
        headers: {
          [headerKey]: `Bearer ${user.idToken}`,
        },
      })

      const res = await app.fetch(req, env)

      expect(res).not.toBeNull()
      expect(res.status).toBe(wantStatus)
    })

    it('specified keyStore is used', async () => {
      const testingJWT = generateDummyJWT()

      const nopKeyStore = new NopKeyStore()
      const getSpy = vi.spyOn(nopKeyStore, 'get')
      const putSpy = vi.spyOn(nopKeyStore, 'put')

      const app = new Hono<{ Bindings: VerifyFirebaseAuthEnv }>()

      resetAuth()

      app.use(
        '*',
        verifyFirebaseAuth({
          projectId: validProjectId,
          keyStore: nopKeyStore,
          disableErrorLog: true,
        })
      )
      app.get('/hello', (c) => c.text('OK'))

      const req = new Request('http://localhost/hello', {
        headers: {
          Authorization: `Bearer ${testingJWT}`,
        },
      })

      // not use firebase emulator to check using key store
      const res = await app.fetch(req, {
        FIREBASE_AUTH_EMULATOR_HOST: undefined,
      })

      expect(res).not.toBeNull()
      expect(res.status).toBe(401)
      expect(getSpy).toHaveBeenCalled()
      expect(putSpy).toHaveBeenCalled()
    })

    it('usable id-token in main handler', async () => {
      const testingJWT = generateDummyJWT()

      const nopKeyStore = new NopKeyStore()
      const app = new Hono<{ Bindings: VerifyFirebaseAuthEnv }>()

      resetAuth()

      app.use(
        '*',
        verifyFirebaseAuth({
          projectId: validProjectId,
          keyStore: nopKeyStore,
          disableErrorLog: true,
        })
      )
      app.get('/hello', (c) => c.json(getFirebaseToken(c)))

      const req = new Request('http://localhost/hello', {
        headers: {
          Authorization: `Bearer ${testingJWT}`,
        },
      })

      const res = await app.fetch(req, {
        FIREBASE_AUTH_EMULATOR_HOST: emulatorHost,
      })

      expect(res).not.toBeNull()
      expect(res.status).toBe(200)

      const json = await res.json<{ aud: string; email: string }>()
      expect(json.aud).toBe(validProjectId)
      expect(json.email).toBe('codehex@hono.js')
    })

    it('invalid PUBLIC_JWK_CACHE_KV is undefined, should be 501', async () => {
      const app = new Hono<{ Bindings: VerifyFirebaseAuthEnv }>()

      resetAuth()

      let gotError: Error | undefined
      app.use(
        '*',
        async (c, next) => {
          await next()
          gotError = c.error
        },
        verifyFirebaseAuth({
          projectId: validProjectId,
          disableErrorLog: true,
        })
      )
      app.get('/hello', (c) => c.text('OK'))

      const req = new Request('http://localhost/hello', {
        headers: {
          Authorization: `Bearer ${user.idToken}`,
        },
      })

      const env: VerifyFirebaseAuthEnv = {
        FIREBASE_AUTH_EMULATOR_HOST: emulatorHost,
        PUBLIC_JWK_CACHE_KV: undefined,
      }
      const res = await app.fetch(req, env)

      expect(gotError instanceof HTTPException).toBeTruthy()
      expect(res).not.toBeNull()
      expect(res.status).toBe(501)
    })
  })
})

describe('verifySessionCookieFirebaseAuth middleware', () => {
  const emulatorHost = '127.0.0.1:9099'
  const validProjectId = 'example-project12345' // see package.json

  const nullScript = 'export default { fetch: () => new Response(null, { status: 404 }) };'
  const mf = new Miniflare({
    modules: true,
    script: nullScript,
    kvNamespaces: ['PUBLIC_JWK_CACHE_KV'],
  })

  let user: signUpResponse

  const env: VerifyFirebaseAuthEnv = {
    FIREBASE_AUTH_EMULATOR_HOST: emulatorHost,
  }

  const expiresIn = 24 * 60 * 60 * 1000

  beforeAll(async () => {
    await deleteAccountEmulator(emulatorHost, validProjectId)

    user = await signUpEmulator(emulatorHost, {
      email: 'codehex@hono.js',
      password: 'honojs',
    })

    await sleep(1000) // wait for iat
  })

  describe('service worker syntax', () => {
    it('valid case, should be 200', async () => {
      const app = new Hono()

      resetAuth()

      // This is assumed to be obtained from an environment variable.
      const PUBLIC_JWK_CACHE_KEY = 'testing-cache-key'
      const PUBLIC_JWK_CACHE_KV = (await mf.getKVNamespace(
        'PUBLIC_JWK_CACHE_KV'
      )) as unknown as KVNamespace

      const cookieName = 'session-key'
      app.get(
        '/hello',
        verifySessionCookieFirebaseAuth({
          projectId: validProjectId,
          cookieName,
          keyStore: WorkersKVStoreSingle.getOrInitialize(PUBLIC_JWK_CACHE_KEY, PUBLIC_JWK_CACHE_KV),
          firebaseEmulatorHost: emulatorHost,
          redirects: {
            signIn: '/login',
          },
        }),
        (c) => c.json(getFirebaseToken(c))
      )

      app.post('/create-session', async (c) => {
        const { idToken } = await c.req.json<{ idToken: string }>()
        const adminAuthClient = AdminAuthApiClient.getOrInitialize(
          validProjectId,
          new NopCredential()
        )
        const sessionCookie = await adminAuthClient.createSessionCookie(idToken, expiresIn, env)
        setCookie(c, cookieName, sessionCookie, {
          httpOnly: true,
        })
        return c.newResponse(null, 200)
      })

      const req1 = new Request('http://localhost/create-session', {
        method: 'POST',
        body: JSON.stringify({
          idToken: user.idToken,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      })
      const res1 = await app.request(req1)
      expect(res1).not.toBeNull()
      expect(res1.status).toBe(200)

      const gotSetCookie = res1.headers.get('Set-Cookie')
      expect(gotSetCookie).not.toBeNull()

      const req2 = new Request('http://localhost/hello', {
        method: 'GET',
        headers: {
          Cookie: gotSetCookie!,
          'Content-Type': 'application/json',
        },
      })
      const res2 = await app.request(req2)

      expect(res2.status).toBe(200)

      const json = await res2.json<{ aud: string; email: string }>()
      expect(json.aud).toBe(validProjectId)
      expect(json.email).toBe('codehex@hono.js')
    })
  })

  describe('module worker syntax', () => {
    const signInPath = '/login'
    const adminAuthClient = AdminAuthApiClient.getOrInitialize(validProjectId, new NopCredential())

    it.each([
      [
        'valid case, should be 200',
        {
          cookieName: 'session',
          config: {
            projectId: validProjectId,
          },
          wantStatus: 200,
        },
      ],
      [
        'valid specified cookie name, should be 200',
        {
          cookieName: 'x-cookie',
          config: {
            projectId: validProjectId,
            cookieName: 'x-cookie',
          },
          wantStatus: 200,
        },
      ],
      [
        'mismatched cookie name, should be 302',
        {
          cookieName: 'x-cookie',
          config: {
            projectId: validProjectId, // see package.json
            // No specified cookie name.
          },
          wantStatus: 302,
        },
      ],
      [
        'invalid project ID, should be 302',
        {
          cookieName: 'session',
          config: {
            projectId: 'invalid-projectId',
          },
          wantStatus: 302,
        },
      ],
    ])('%s', async (_, { cookieName, config, wantStatus }) => {
      const app = new Hono<{ Bindings: VerifyFirebaseAuthEnv }>()

      resetAuth()

      const PUBLIC_JWK_CACHE_KV = (await mf.getKVNamespace(
        'PUBLIC_JWK_CACHE_KV'
      )) as unknown as KVNamespace
      const env: VerifyFirebaseAuthEnv = {
        FIREBASE_AUTH_EMULATOR_HOST: emulatorHost,
        PUBLIC_JWK_CACHE_KEY: 'testing-cache-key',
        PUBLIC_JWK_CACHE_KV,
      }

      let gotError: Error | undefined
      app.use(
        '*',
        async (c, next) => {
          await next()
          gotError = c.error
        },
        verifySessionCookieFirebaseAuth({
          ...config,
          redirects: {
            signIn: signInPath,
          },
        })
      )
      app.get('/hello', (c) => c.text('OK'))

      const sessionCookie = await adminAuthClient.createSessionCookie(user.idToken, expiresIn, env)

      const req = new Request('http://localhost/hello', {
        headers: {
          Cookie: `${cookieName}=${sessionCookie}; Path=/; HttpOnly`,
        },
      })

      const res = await app.fetch(req, env)

      expect(res).not.toBeNull()
      expect(res.status).toBe(wantStatus)
      if (wantStatus === 302) {
        expect(gotError instanceof HTTPException).toBeTruthy()
        expect(res.headers.get('location')).toBe(signInPath)
      }
    })

    // NOTE(codehex): We can't check this test because https://identitytoolkit.googleapis.com/v1/sessionCookiePublicKeys endpoint
    // responds with `cache-control: no-cache, no-store, max-age=0, must-revalidate`
    //
    // it('specified keyStore is used', async () => {
    //   const nopKeyStore = new NopKeyStore()
    //   const getSpy = vi.spyOn(nopKeyStore, 'get')
    //   const putSpy = vi.spyOn(nopKeyStore, 'put')

    //   const app = new Hono<{ Bindings: VerifyFirebaseAuthEnv }>()

    //   resetAuth()

    //   const signInPath = '/login'
    //   app.use(
    //     '*',
    //     verifySessionCookieFirebaseAuth({
    //       projectId: validProjectId,
    //       keyStore: nopKeyStore,
    //       redirects: {
    //         signIn: signInPath,
    //       },
    //     })
    //   )
    //   app.get('/hello', (c) => c.text('OK'))

    //   const sessionCookie = await adminAuthClient.createSessionCookie(user.idToken, expiresIn, env)

    //   const req = new Request('http://localhost/hello', {
    //     headers: {
    //       Cookie: `session=${sessionCookie}; Path=/; HttpOnly`,
    //     },
    //   })

    //   // not use firebase emulator to check using key store
    //   const res = await app.fetch(req, {
    //     FIREBASE_AUTH_EMULATOR_HOST: undefined,
    //   })

    //   expect(res).not.toBeNull()
    //   expect(res.status).toBe(302)
    //   expect(res.headers.get('location')).toBe(signInPath)
    //   expect(getSpy).toHaveBeenCalled()
    //   expect(putSpy).toHaveBeenCalled()
    // })

    it('usable id-token in main handler', async () => {
      const nopKeyStore = new NopKeyStore()
      const app = new Hono<{ Bindings: VerifyFirebaseAuthEnv }>()

      resetAuth()

      app.use(
        '*',
        verifySessionCookieFirebaseAuth({
          projectId: validProjectId,
          keyStore: nopKeyStore,
          redirects: {
            signIn: signInPath,
          },
        })
      )
      app.get('/hello', (c) => c.json(getFirebaseToken(c)))

      const sessionCookie = await adminAuthClient.createSessionCookie(user.idToken, expiresIn, env)

      const req = new Request('http://localhost/hello', {
        headers: {
          Cookie: `session=${sessionCookie}; Path=/; HttpOnly`,
        },
      })

      const res = await app.fetch(req, {
        FIREBASE_AUTH_EMULATOR_HOST: emulatorHost,
      })

      expect(res).not.toBeNull()
      expect(res.status).toBe(200)

      const json = await res.json<{ aud: string; email: string }>()
      expect(json.aud).toBe(validProjectId)
      expect(json.email).toBe('codehex@hono.js')
    })

    it('invalid PUBLIC_JWK_CACHE_KV is undefined, should be 501', async () => {
      const app = new Hono<{ Bindings: VerifyFirebaseAuthEnv }>()

      resetAuth()

      let gotError: Error | undefined
      app.use(
        '*',
        async (c, next) => {
          await next()
          gotError = c.error
        },
        verifySessionCookieFirebaseAuth({
          projectId: validProjectId,
          redirects: {
            signIn: signInPath,
          },
        })
      )
      app.get('/hello', (c) => c.text('OK'))

      const sessionCookie = await adminAuthClient.createSessionCookie(user.idToken, expiresIn, env)

      const req = new Request('http://localhost/hello', {
        headers: {
          Cookie: `session=${sessionCookie}; Path=/; HttpOnly`,
        },
      })

      const res = await app.fetch(req, {
        FIREBASE_AUTH_EMULATOR_HOST: emulatorHost,
        PUBLIC_JWK_CACHE_KV: undefined,
      })

      expect(gotError instanceof HTTPException).toBeTruthy()
      expect(res).not.toBeNull()
      expect(res.status).toBe(501)
    })
  })
})

class NopKeyStore implements KeyStorer {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  constructor() {}
  get(): Promise<null> {
    return new Promise((resolve) => resolve(null))
  }
  put(): Promise<void> {
    return new Promise((resolve) => resolve())
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// magic to reset state of static object for "firebase-auth-cloudflare-workers"
const resetAuth = () => delete Auth['instance']

const generateDummyJWT = () => {
  const header = JSON.stringify({
    alg: 'RS256',
    kid: 'kid',
    typ: 'JWT',
  })
  const now = Math.floor(Date.now() / 1000)
  const payload = JSON.stringify({
    iss: 'https://securetoken.google.com/example-project12345',
    aud: 'example-project12345',
    auth_time: now - 1000,
    user_id: 't1aLdTkAs0S0J0P6TNbjwbmry5B3',
    sub: 't1aLdTkAs0S0J0P6TNbjwbmry5B3',
    iat: now - 1000,
    exp: now + 3000, // + 3s
    email: 'codehex@hono.js',
    email_verified: false,
    firebase: {
      identities: {
        email: ['codehex@hono.js'],
      },
      sign_in_provider: 'password',
    },
  })
  return `${btoa(header)}.${btoa(payload)}.`
}

interface EmailPassword {
  email: string
  password: string
}

export interface signUpResponse {
  kind: string
  localId: string
  email: string
  idToken: string
  refreshToken: string
  expiresIn: string
}

const signUpEmulator = async (
  emulatorHost: string,
  body: EmailPassword
): Promise<signUpResponse> => {
  // http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=dummy
  const url = `http://${emulatorHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=dummy`
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...body,
      returnSecureToken: true,
    }),
  })
  if (resp.status !== 200) {
    console.log({ status: resp.status })
    throw new Error('error')
  }
  return await resp.json()
}

const deleteAccountEmulator = async (emulatorHost: string, projectId: string): Promise<void> => {
  // https://firebase.google.com/docs/reference/rest/auth#section-auth-emulator-clearaccounts
  const url = `http://${emulatorHost}/emulator/v1/projects/${projectId}/accounts`
  const resp = await fetch(url, {
    method: 'DELETE',
  })
  if (resp.status !== 200) {
    console.log({ status: resp.status })
    throw new Error('error when clear accounts')
  }
  return
}

export class NopCredential implements Credential {
  getAccessToken(): Promise<GoogleOAuthAccessToken> {
    return Promise.resolve({
      access_token: 'owner',
      expires_in: 9 * 3600,
    })
  }
}
