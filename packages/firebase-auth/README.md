# Hono Firebase Auth middleware for Cloudflare Workers

This is a Firebase Auth middleware library for [Hono](https://github.com/honojs/hono) which is used [firebase-auth-cloudflare-workers](https://github.com/Code-Hex/firebase-auth-cloudflare-workers).

Currently only Cloudflare Workers are supported officially. However, it may work in other environments as well, so please let us know in an issue if it works.

## Synopsis

### Module Worker Syntax (recommend)

```ts
import { Hono } from 'hono'
import {
  VerifyFirebaseAuthConfig,
  VerifyFirebaseAuthEnv,
  verifyFirebaseAuth,
  getFirebaseToken,
} from '@hono/firebase-auth'

const config: VerifyFirebaseAuthConfig = {
  // specify your firebase project ID.
  projectId: 'your-project-id',
}

// You can specify here the extended VerifyFirebaseAuthEnv type.
//
// If you do not specify `keyStore` in the configuration, you need to set
// the variables `PUBLIC_JWK_CACHE_KEY` and `PUBLIC_JWK_CACHE_KV` in your
// wrangler.toml. This is because `WorkersKVStoreSingle` is used by default.
//
// For more details, please refer to: https://github.com/Code-Hex/firebase-auth-cloudflare-workers
const app = new Hono<{ Bindings: VerifyFirebaseAuthEnv }>()

// set middleware
app.use('*', verifyFirebaseAuth(config))
app.get('/hello', (c) => {
  const idToken = getFirebaseToken(c) // get id-token object.
  return c.json(idToken)
})

export default app
```

### Service Worker Syntax

```ts
import { Hono } from 'hono'
import { VerifyFirebaseAuthConfig, verifyFirebaseAuth, getFirebaseToken } from '@hono/firebase-auth'

const config: VerifyFirebaseAuthConfig = {
  // specify your firebase project ID.
  projectId: 'your-project-id',
  // this is optional. but required in this mode.
  keyStore: WorkersKVStoreSingle.getOrInitialize(PUBLIC_JWK_CACHE_KEY, PUBLIC_JWK_CACHE_KV),
  // this is also optional. But in this mode, you can only specify here.
  firebaseEmulatorHost: FIREBASE_AUTH_EMULATOR_HOST,
}

const app = new Hono()

// set middleware
app.use('*', verifyFirebaseAuth(config))
app.get('/hello', (c) => {
  const idToken = getFirebaseToken(c) // get id-token object.
  return c.json(idToken)
})

app.fire()
```

## Config (`VerifyFirebaseAuthConfig`)

### `projectId: string` (**required**)

This field indicates your firebase project ID.

### `useCookie: boolean` (**required**)

This field, if set to true will pick the token to verify from a cookie instead of Authorization headers.  

### `authorizationHeaderKey?: string` (optional)

Based on this configuration, the JWT created by firebase auth is looked for in the HTTP headers. The default is "Authorization".

### `cookieName?: string` (optional)

Based on this configuration, the JWT created by firebase auth is looked for in the HTTP cookie using this name. The default is "authorization".

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

## Security Considerations when using cookies for authentication

When considering that a web framework uses tokens via cookies, security measures related to traditional browsers and cookies must be considered.

    CSRF (Cross-Site Request Forgery)
    XSS (Cross-Site Scripting)
    MitM (Man-in-the-middle attack)

Let's consider each:

**CSRF**

This is provided by hono as a standard middleware feature

https://hono.dev/middleware/builtin/csrf

**XSS**

An attacker can inject a script and steal JWTs stored in cookies. Set the httpOnly flag on the cookie to prevent access from JavaScript. Additionally, configure "Content Security Policy" (CSP) to prevent unauthorized script execution. It is recommeded to force httpOnly and the functionality here: https://hono.dev/middleware/builtin/secure-headers

**MitM**

If your cookie security settings are inappropriate, there is a risk that your cookies will be stolen by a MitM. Use Samesite (or hono csrf middleware) and __Secure- prefix and __Host- prefix attributes.

https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#attributes

An example of good cookie settings:

```
let secureCookieSettings: CookieOptions = {
  path: '/',
  domain: <your_domain>,
  secure: true,
  httpOnly: true,
  sameSite: 'Strict',
}
```

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
