# Hono Firebase Auth middleware for Cloudflare Workers.

This is a Firebase Auth middleware library for [Hono](https://github.com/honojs/hono) which is used [firebase-auth-cloudflare-workers](https://github.com/Code-Hex/firebase-auth-cloudflare-workers).

Currently only Cloudflare Workers are supported officially. However, it may work in other environments as well, so please let us know in an issue if it works.

## Synopsis

### Module Worker Syntax (recommend)

```ts
import { Hono } from "hono";
import { VerifyFirebaseAuthConfig, VerifyFirebaseAuthEnv, verifyFirebaseAuth, getFirebaseToken } from "@honojs/firebase-auth";

const config: VerifyFirebaseAuthConfig = {
  // specify your firebase project ID.
  projectId: "your-project-id",
}

// Or you can specify here the extended VerifyFirebaseAuthEnv type.
const app = new Hono<{ Bindings: VerifyFirebaseAuthEnv }>()

// set middleware
app.use("*", verifyFirebaseAuth(config));
app.get("/hello", (c) => {
  const idToken = getFirebaseToken(c) // get id-token object.
  return c.json(idToken)
});

export default app
```

### Service Worker Syntax

```ts
import { Hono } from "hono";
import { VerifyFirebaseAuthConfig, verifyFirebaseAuth, getFirebaseToken } from "@honojs/firebase-auth";

const config: VerifyFirebaseAuthConfig = {
  // specify your firebase project ID.
  projectId: "your-project-id",
  // this is optional. but required in this mode.
  keyStore: WorkersKVStoreSingle.getOrInitialize(
    PUBLIC_JWK_CACHE_KEY,
    PUBLIC_JWK_CACHE_KV
  ),
  // this is also optional. But in this mode, you can only specify here.
  firebaseEmulatorHost: FIREBASE_AUTH_EMULATOR_HOST,
}

const app = new Hono()

// set middleware
app.use("*", verifyFirebaseAuth(config));
app.get("/hello", (c) => {
  const idToken = getFirebaseToken(c) // get id-token object.
  return c.json(idToken)
});

app.fire()
```


## Config (`VerifyFirebaseAuthConfig`)

### `projectId: string` (**required**)

This field indicates your firebase project ID.

### `authorizationHeaderKey?: string` (optional)

Based on this configuration, the JWT created by firebase auth is looked for in the HTTP headers. The default is "Authorization".

### `keyStore?: KeyStorer` (optional)

This is used to cache the public key used to validate the Firebase ID token (JWT). This KeyStorer type has been defined in [firebase-auth-cloudflare-workers](https://github.com/Code-Hex/firebase-auth-cloudflare-workers/tree/main#keystorer) library. 

If you don't specify the field, this library uses [WorkersKVStoreSingle](https://github.com/Code-Hex/firebase-auth-cloudflare-workers/tree/main#workerskvstoresinglegetorinitializecachekey-string-cfkvnamespace-kvnamespace-workerskvstoresingle) instead. You must fill in the fields defined in `VerifyFirebaseAuthEnv`.

### `keyStoreInitializer?: (c: Context) => KeyStorer` (optional)

Use this when initializing KeyStorer and environment variables, etc. are required.

If you don't specify the field, this library uses [WorkersKVStoreSingle](https://github.com/Code-Hex/firebase-auth-cloudflare-workers/tree/main#workerskvstoresinglegetorinitializecachekey-string-cfkvnamespace-kvnamespace-workerskvstoresingle) instead. You must fill in the fields defined in `VerifyFirebaseAuthEnv`.

### `disableErrorLog?: boolean` (optional)

Throws an exception if JWT validation fails. By default, this is output to the error log, but if you don't expect it, use this.

### `firebaseEmulatorHost?: string` (optional)

You can specify a host for the Firebase Auth emulator. This config is mainly used when **Service Worker Syntax** is used.

If not specified, check the [`FIREBASE_AUTH_EMULATOR_HOST` environment variable obtained from the request](https://github.com/Code-Hex/firebase-auth-cloudflare-workers#emulatorenv).

## Author

codehex <https://github.com/Code-Hex>

## License

MIT

## Contribution

If you are interested, send me PR would be greatly appreciated!

To test this code in your local environment, execute the following command.

```
$ yarn test-with-emulator
```