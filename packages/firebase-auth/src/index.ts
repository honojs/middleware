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
  keyStore?: KeyStorer
  keyStoreInitializer?: (c: Context) => KeyStorer
  disableErrorLog?: boolean
  firebaseEmulatorHost?: string
}

const defaultKVStoreJWKCacheKey = 'verify-firebase-auth-cached-public-key'
const defaultKeyStoreInitializer = (c: Context<{ Bindings: VerifyFirebaseAuthEnv }>): KeyStorer => {
  if (c.env.PUBLIC_JWK_CACHE_KV === undefined) {
    const status = 501
    throw new HTTPException(status, {
      res: new Response('Not Implemented', { status }),
    })
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
      const status = 400
      throw new HTTPException(status, {
        res: new Response('Bad Request', { status }),
        message: 'authorization header is empty',
      })
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

      const status = 401
      throw new HTTPException(status, {
        res: new Response('Unauthorized', { status }),
        message: `failed to verify the requested firebase token: ${String(err)}`,
        cause: err,
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

export interface VerifySessionCookieFirebaseAuthConfig {
  projectId: string
  cookieName?: string
  keyStore?: KeyStorer
  keyStoreInitializer?: (c: Context) => KeyStorer
  firebaseEmulatorHost?: string
  redirects: {
    signIn: string
  }
}

export const verifySessionCookieFirebaseAuth = (
  userConfig: VerifySessionCookieFirebaseAuthConfig
): MiddlewareHandler => {
  const config = {
    projectId: userConfig.projectId,
    cookieName: userConfig.cookieName ?? 'session',
    keyStore: userConfig.keyStore,
    keyStoreInitializer: userConfig.keyStoreInitializer ?? defaultKeyStoreInitializer,
    firebaseEmulatorHost: userConfig.firebaseEmulatorHost,
    redirects: userConfig.redirects,
  } satisfies VerifySessionCookieFirebaseAuthConfig

  // TODO(codehex): will be supported
  const checkRevoked = false

  return async (c, next) => {
    const auth = Auth.getOrInitialize(
      config.projectId,
      config.keyStore ?? config.keyStoreInitializer(c)
    )
    const session = getCookie(c, config.cookieName)
    if (session === undefined) {
      const status = 302
      const res = c.redirect(config.redirects.signIn, status)
      throw new HTTPException(status, { res, message: 'session is empty' })
    }

    try {
      const idToken = await auth.verifySessionCookie(session, checkRevoked, {
        FIREBASE_AUTH_EMULATOR_HOST:
          config.firebaseEmulatorHost ?? c.env.FIREBASE_AUTH_EMULATOR_HOST,
      })
      setFirebaseToken(c, idToken)
    } catch (err) {
      const status = 302
      const res = c.redirect(config.redirects.signIn, status)
      throw new HTTPException(status, {
        res,
        message: `failed to verify the requested firebase token: ${String(err)}`,
        cause: err,
      })
    }
    await next()
  }
}
