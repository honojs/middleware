import type { KeyStorer } from 'firebase-auth-cloudflare-workers'
import { Auth, WorkersKVStoreSingle } from 'firebase-auth-cloudflare-workers'
import { Hono } from 'hono'
import type { VerifyFirebaseAuthEnv } from '../src'
import { verifyFirebaseAuth, getFirebaseToken } from '../src'

describe('verifyFirebaseAuth middleware', () => {
  const emulatorHost = '127.0.0.1:9099'
  const validProjectId = 'example-project12345' // see package.json

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const { PUBLIC_JWK_CACHE_KV } = getMiniflareBindings()

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
    test('valid case, should be 200', async () => {
      const app = new Hono()

      resetAuth()

      // This is assumed to be obtained from an environment variable.
      const PUBLIC_JWK_CACHE_KEY = 'testing-cache-key'

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
    test.each([
      [
        'valid case, should be 200',
        {
          headerKey: 'Authorization',
          env: {
            FIREBASE_AUTH_EMULATOR_HOST: 'localhost:9099',
            PUBLIC_JWK_CACHE_KEY: 'testing-cache-key',
            PUBLIC_JWK_CACHE_KV,
          },
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
          env: {
            FIREBASE_AUTH_EMULATOR_HOST: 'localhost:9099',
            PUBLIC_JWK_CACHE_KEY: 'testing-cache-key',
            PUBLIC_JWK_CACHE_KV,
          },
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
          env: {
            FIREBASE_AUTH_EMULATOR_HOST: 'localhost:9099',
            PUBLIC_JWK_CACHE_KEY: 'testing-cache-key',
            PUBLIC_JWK_CACHE_KV,
          },
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
          env: {
            FIREBASE_AUTH_EMULATOR_HOST: 'localhost:9099',
            PUBLIC_JWK_CACHE_KEY: 'testing-cache-key',
            PUBLIC_JWK_CACHE_KV,
          },
          config: {
            projectId: 'invalid-projectId',
          },
          wantStatus: 401,
        },
      ],
    ])('%s', async (_, { headerKey, env, config, wantStatus }) => {
      const app = new Hono<{ Bindings: VerifyFirebaseAuthEnv }>()

      resetAuth()

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

    test('specified keyStore is used', async () => {
      const testingJWT = generateDummyJWT()

      const nopKeyStore = new NopKeyStore()
      const getSpy = jest.spyOn(nopKeyStore, 'get')
      const putSpy = jest.spyOn(nopKeyStore, 'put')

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

    test('usable id-token in main handler', async () => {
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
