import type { KeyStorer, FirebaseIdToken } from 'firebase-auth-cloudflare-workers'
import { Auth, WorkersKVStoreSingle } from 'firebase-auth-cloudflare-workers'
import type { Context, MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'
import { HTTPException } from 'hono/http-exception'

export type VerifyFirebaseAuthEnv = {
  PUBLIC_JWK_CACHE_KEY?: string | undefined
  PUBLIC_JWK_CACHE_KV?: KVNamespace | undefined
  FIREBASE_AUTH_EMULATOR_HOST: string | undefined
}

export interface VerifyFirebaseAuthConfig {
  projectId: string
  authorizationHeaderKey?: string
  useCookie: boolean
  cookieName?: string
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
    AuthorizationHeaderKey: userConfig.authorizationHeaderKey ?? 'Authorization',
    useCookie: userConfig.useCookie,
    cookieName: userConfig.cookieName ?? 'authorization',
    KeyStore: userConfig.keyStore,
    keyStoreInitializer: userConfig.keyStoreInitializer ?? defaultKeyStoreInitializer,
    disableErrorLog: userConfig.disableErrorLog,
    firebaseEmulatorHost: userConfig.firebaseEmulatorHost,
  }

  return async (c, next) => {
    const authorization = config.useCookie ? getCookie(c, config.cookieName) : c.req.headers.get(config.AuthorizationHeaderKey)
    if (authorization === null || authorization === undefined) {
      const res = new Response('Bad Request', {
        status: 400,
      })
      throw new HTTPException(400, { res })
    }
    const jwt = config.useCookie ? authorization : authorization.replace(/Bearer\s+/i, '')
    const auth = Auth.getOrInitialize(
      config.projectId,
      config.KeyStore ?? config.keyStoreInitializer(c)
    )

    try {
      const idToken = await auth.verifyIdToken(jwt, {
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
      throw new HTTPException(401, { res })
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
