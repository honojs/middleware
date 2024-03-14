# Hono Firebase Auth middleware for Cloudflare Workers

This is a Firebase Auth middleware library for [Hono](https://github.com/honojs/hono) which is used [firebase-auth-cloudflare-workers](https://github.com/Code-Hex/firebase-auth-cloudflare-workers).

Currently only Cloudflare Workers are supported officially. However, it may work in other environments as well, so please let us know in an issue if it works.

## Synopsis (verify w/ authorization header)

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

## Synopsis (verify w/ session cookie)

### Module Worker Syntax (recommend)

```ts
import { Hono } from 'hono'
import { setCookie } from 'hono/cookie';
import { csrf } from 'hono/csrf';
import { html } from 'hono/html';
import {
  VerifySessionCookieFirebaseAuthConfig,
  VerifyFirebaseAuthEnv,
  verifySessionCookieFirebaseAuth,
  getFirebaseToken,
} from '@hono/firebase-auth'
import { AdminAuthApiClient, ServiceAccountCredential } from 'firebase-auth-cloudflare-workers';

const config: VerifySessionCookieFirebaseAuthConfig = {
  // specify your firebase project ID.
  projectId: 'your-project-id',
  redirects: {
    signIn: "/login"
  }
}

// You can specify here the extended VerifyFirebaseAuthEnv type.
//
// If you do not specify `keyStore` in the configuration, you need to set
// the variables `PUBLIC_JWK_CACHE_KEY` and `PUBLIC_JWK_CACHE_KV` in your
// wrangler.toml. This is because `WorkersKVStoreSingle` is used by default.
//
// For more details, please refer to: https://github.com/Code-Hex/firebase-auth-cloudflare-workers
type MyEnv = VerifyFirebaseAuthEnv & {
  // See: https://github.com/Code-Hex/firebase-auth-cloudflare-workers?tab=readme-ov-file#adminauthapiclientgetorinitializeprojectid-string-credential-credential-retryconfig-retryconfig-adminauthapiclient
  SERVICE_ACCOUNT_JSON: string
}

const app = new Hono<{ Bindings: MyEnv }>()

// set middleware
app.get('/login', csrf(), async c => {
  // You can copy code from here
  // https://github.com/Code-Hex/firebase-auth-cloudflare-workers/blob/0ce610fff257b0b60e2f8e38d89c8e012497d537/example/index.ts#L63C25-L63C37
  const content = await html`...`
  return c.html(content)
})

app.post('/login_session', csrf(), (c) => {
  const json = await c.req.json();
  const idToken = json.idToken;
  if (!idToken || typeof idToken !== 'string') {
    return c.json({ message: 'invalid idToken' }, 400);
  }
  // Set session expiration to 5 days.
  const expiresIn = 60 * 60 * 24 * 5 * 1000;

  // Create the session cookie. This will also verify the ID token in the process.
  // The session cookie will have the same claims as the ID token.
  // To only allow session cookie setting on recent sign-in, auth_time in ID token
  // can be checked to ensure user was recently signed in before creating a session cookie.
  const auth = AdminAuthApiClient.getOrInitialize(
    c.env.PROJECT_ID,
    new ServiceAccountCredential(c.env.SERVICE_ACCOUNT_JSON)
  );
  const sessionCookie = await auth.createSessionCookie(
    idToken,
    expiresIn,
  );
  setCookie(c, 'session', sessionCookie, {
    maxAge: expiresIn,
    httpOnly: true,
    secure: true
  });
  return c.json({ message: 'success' });
})

app.use('/admin/*', csrf(), verifySessionCookieFirebaseAuth(config));
app.get('/admin/hello', (c) => {
  const idToken = getFirebaseToken(c) // get id-token object.
  return c.json(idToken)
})


export default app
```

## Config (`VerifySessionCookieFirebaseAuthConfig`)

### `projectId: string` (**required**)

This field indicates your firebase project ID.

### `redirects: object` (**required**)

This object has a property named redirects, which in turn has a property named `signIn` of type string.

The `signIn` property is expected to hold a string representing the path to redirect to after a user has failed to sign-in.

### `cookieName?: string` (optional)

Based on this configuration, the session token has created by firebase auth is looked for in the cookie. The default is "session".

### `keyStore?: KeyStorer` (optional)

This is used to cache the public key used to validate the Firebase ID token (JWT). This KeyStorer type has been defined in [firebase-auth-cloudflare-workers](https://github.com/Code-Hex/firebase-auth-cloudflare-workers/tree/main#keystorer) library.

If you don't specify the field, this library uses [WorkersKVStoreSingle](https://github.com/Code-Hex/firebase-auth-cloudflare-workers/tree/main#workerskvstoresinglegetorinitializecachekey-string-cfkvnamespace-kvnamespace-workerskvstoresingle) instead. You must fill in the fields defined in `VerifyFirebaseAuthEnv`.

### `keyStoreInitializer?: (c: Context) => KeyStorer` (optional)

Use this when initializing KeyStorer and environment variables, etc. are required.

If you don't specify the field, this library uses [WorkersKVStoreSingle](https://github.com/Code-Hex/firebase-auth-cloudflare-workers/tree/main#workerskvstoresinglegetorinitializecachekey-string-cfkvnamespace-kvnamespace-workerskvstoresingle) instead. You must fill in the fields defined in `VerifyFirebaseAuthEnv`.

### `firebaseEmulatorHost?: string` (optional)

You can specify a host for the Firebase Auth emulator. This config is mainly used when **Service Worker Syntax** is used.

If not specified, check the [`FIREBASE_AUTH_EMULATOR_HOST` environment variable obtained from the request](https://github.com/Code-Hex/firebase-auth-cloudflare-workers#emulatorenv).

### What content should I read?

- [Manage Session Cookies](https://firebase.google.com/docs/auth/admin/manage-cookies)

### Security Considerations when using session cookies

When considering that a web framework uses tokens via cookies, security measures related to traditional browsers and cookies should be considered.

1. CSRF (Cross-Site Request Forgery)
2. XSS (Cross-Site Scripting)
3. MitM (Man-in-the-middle attack)

Let's consider each:

**CSRF**

This is provided by hono as a standard middleware feature

https://hono.dev/middleware/builtin/csrf

**XSS**

An attacker can inject a script and steal JWTs stored in cookies. Set the httpOnly flag on the cookie to prevent access from JavaScript. Additionally, configure "Content Security Policy" (CSP) to prevent unauthorized script execution. It is recommeded to force httpOnly and the functionality here: https://hono.dev/middleware/builtin/secure-headers

**MitM**

If your cookie security settings are inappropriate, there is a risk that your cookies will be stolen by a MitM. Use Samesite (or hono csrf middleware) and `__Secure-` prefix and `__Host-` prefix attributes.

https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#attributes

An example of good cookie settings:

```ts
const secureCookieSettings: CookieOptions = {
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
