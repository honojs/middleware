import { Context, Handler } from "hono";
import {
  EmulatorEnv,
  Auth,
  WorkersKVStoreSingle,
  KeyStorer,
  FirebaseIdToken,
} from "firebase-auth-cloudflare-workers";

export interface VerifyFirebaseAuthEnv extends EmulatorEnv {
  PUBLIC_JWK_CACHE_KEY?: string | undefined;
  PUBLIC_JWK_CACHE_KV?: KVNamespace | undefined;
}

export interface VerifyFirebaseAuthConfig {
  projectId: string;
  authorizationHeaderKey?: string;
  keyStore?: KeyStorer;
  keyStoreInitializer?: (c: Context) => KeyStorer;
  disableErrorLog?: boolean;
  firebaseEmulatorHost?: string;
}

const defaultKVStoreJWKCacheKey = "verify-firebase-auth-cached-public-key";
const defaultKeyStoreInitializer = (c: Context): KeyStorer => {
  return WorkersKVStoreSingle.getOrInitialize(
    c.env.PUBLIC_JWK_CACHE_KEY ?? defaultKVStoreJWKCacheKey,
    c.env.PUBLIC_JWK_CACHE_KV
  );
};

export const verifyFirebaseAuth = (
  userConfig: VerifyFirebaseAuthConfig
): Handler => {
  const config = {
    projectId: userConfig.projectId,
    AuthorizationHeaderKey:
      userConfig.authorizationHeaderKey ?? "Authorization",
    KeyStore: userConfig.keyStore,
    keyStoreInitializer:
      userConfig.keyStoreInitializer ?? defaultKeyStoreInitializer,
    disableErrorLog: userConfig.disableErrorLog,
    firebaseEmulatorHost: userConfig.firebaseEmulatorHost,
  };

  return async (c, next) => {
    const authorization = c.req.headers.get(config.AuthorizationHeaderKey);
    if (authorization === null) {
      return new Response(null, {
        status: 400,
      });
    }
    const jwt = authorization.replace(/Bearer\s+/i, "");
    const auth = Auth.getOrInitialize(
      config.projectId,
      config.KeyStore ?? config.keyStoreInitializer(c)
    );

    try {
      const idToken = await auth.verifyIdToken(jwt, {
        FIREBASE_AUTH_EMULATOR_HOST:
          config.firebaseEmulatorHost ?? c.env.FIREBASE_AUTH_EMULATOR_HOST,
      });
      setFirebaseToken(c, idToken);
    } catch (err) {
      if (!userConfig.disableErrorLog) {
        console.error({
          message: "failed to verify the requested firebase token",
          err,
        });
      }
      return new Response(null, {
        status: 401,
      });
    }
    await next();
  };
};

const idTokenContextKey = "firebase-auth-cloudflare-id-token-key";

const setFirebaseToken = (c: Context, idToken: FirebaseIdToken) =>
  c.set(idTokenContextKey, idToken);

export const getFirebaseToken = (c: Context): FirebaseIdToken | null => {
  const idToken = c.get(idTokenContextKey);
  if (!idToken) return null;
  return idToken;
};
