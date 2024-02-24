import type { KeyStorer, FirebaseIdToken } from 'firebase-auth-cloudflare-workers'
import { Auth, WorkersKVStoreSingle } from 'firebase-auth-cloudflare-workers'
import type { Context, MiddlewareHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'

export type VerifyFirebaseAuthEnv = {
  PUBLIC_JWK_CACHE_KEY?: string | undefined
  PUBLIC_JWK_CACHE_KV?: KVNamespace | undefined
  FIREBASE_AUTH_EMULATOR_HOST: string | undefined
}

export interface VerifyFirebaseAuthConfig {
  projectId: string
  authorizationHeaderKey?: string
  keyStore?: KeyStorer
  keyStoreInitializer?: (c: Context) => KeyStorer
  disableErrorLog?: boolean
  firebaseEmulatorHost?: string
}

const defaultKVStoreJWKCacheKey = 'verify-firebase-auth-cached-public-key'
const defaultKeyStoreInitializer = (c: Context<{ Bindings: VerifyFirebaseAuthEnv }>): KeyStorer => {
  if (c.env.PUBLIC_JWK_CACHE_KV === undefined) {
    const res = new Response('Not Implemented', {
      status: 501,
    })
    throw new HTTPException(501, { res })
  }
  return WorkersKVStoreSingle.getOrInitialize(
    c.env.PUBLIC_JWK_CACHE_KEY ?? defaultKVStoreJWKCacheKey,
    c.env.PUBLIC_JWK_CACHE_KV
  )
}

export const verifyFirebaseAuth = (userConfig: VerifyFirebaseAuthConfig): MiddlewareHandler => {
  const config = {
    projectId: userConfig.projectId,
    authorizationHeaderKey: userConfig.authorizationHeaderKey ?? 'Authorization',
    keyStore: userConfig.keyStore,
    keyStoreInitializer: userConfig.keyStoreInitializer ?? defaultKeyStoreInitializer,
    disableErrorLog: userConfig.disableErrorLog,
    firebaseEmulatorHost: userConfig.firebaseEmulatorHost,
  } satisfies VerifyFirebaseAuthConfig

  // TODO(codehex): will be supported
  const checkRevoked = false

  return async (c, next) => {
    const authorization = c.req.raw.headers.get(config.authorizationHeaderKey)
    if (authorization === null) {
      const res = new Response('Bad Request', {
        status: 400,
      })
      throw new HTTPException(res.status, { res, message: 'authorization header is empty' })
    }
    const jwt = authorization.replace(/Bearer\s+/i, '')
    const auth = Auth.getOrInitialize(
      config.projectId,
      config.keyStore ?? config.keyStoreInitializer(c)
    )

    try {
      const idToken = await auth.verifyIdToken(jwt, checkRevoked, {
        FIREBASE_AUTH_EMULATOR_HOST:
          config.firebaseEmulatorHost ?? c.env.FIREBASE_AUTH_EMULATOR_HOST,
      })
      setFirebaseToken(c, idToken)
    } catch (err) {
      if (!userConfig.disableErrorLog) {
        console.error({
          message: 'failed to verify the requested firebase token',
          err,
        })
      }

      const res = new Response('Unauthorized', {
        status: 401,
      })
      throw new HTTPException(res.status, {
        res,
        message: `failed to verify the requested firebase token: ${String(err)}`,
      })
    }
    await next()
  }
}

const idTokenContextKey = 'firebase-auth-cloudflare-id-token-key'

const setFirebaseToken = (c: Context, idToken: FirebaseIdToken) => c.set(idTokenContextKey, idToken)

export const getFirebaseToken = (c: Context): FirebaseIdToken | null => {
  const idToken = c.get(idTokenContextKey)
  if (!idToken) {
    return null
  }
  return idToken
}
