# Hono Appwrite auth middleware

This is an Appwrite Auth middleware library for [Hono](https://github.com/honojs/hono) that uses Appwrite's [SSR](https://appwrite.io/docs/products/auth/server-side-rendering) login.

This package also provides some [helpers](#helpers) that will make the login process much easier.

## Installation

```plain
npm i hono @hono/appwrite-auth node-appwrite
```

## Usage

1. Set Appwrite config using the `initAppwrite` function.
2. Protect routes using the `appwriteMiddleware` function.
3. Get the user object anywhere using the `getAuth` function.

```ts
import { Hono } from 'hono'
import { getAuth, appwriteMiddleware, initAppwrite } from '@hono/appwrite-auth'

const app = new Hono()

const appwriteConfig = {
  endpoint  : 'https://cloud.appwrite.io/v1',
  projectId : '<YOUR_PROJECT_ID>',
  apiKey    : '<API_KEY>',
  cookieName: 'appwrite_secure_ssr',
}

app.use('*', initAppwrite(appwriteConfig))

app.get('/', (c) => c.text('No auth required'))

app.use('/api/*', appwriteMiddleware())

app.get('/api/user/prefs', (c) => {
  const user = getAuth(c)

  return c.json({ preferences: user.prefs })
})

export default app
```

## Helpers

### Email login

This helper is expecting to get the email and password name `email` & `password` in a post `application/json` body.

```ts
import { appwriteEmailLogin, initAppwrite } from '@hono/appwrite-auth'

app.use('*', initAppwrite(appwriteConfig))

app.post('/login/', appwriteEmailLogin())

export default app
```

### OAuth2 login

Appwrite has support for a wide variety of OAuth2 providers,
you can see the full list [here](https://appwrite.io/docs/references/cloud/client-web/account#createOAuth2Session). a hint? it's big.

```ts
import { appwriteAuth2Save, appwriteAuth2, initAppwrite } from '@hono/appwrite-auth'
import { OAuthProvider } from 'node-appwrite'


app.use('*', initAppwrite(appwriteConfig))

const successUrl = 'https://your.website.com//auth2/google/success'
const failureUrl = 'https://your.website.com//auth2/google/success'

/*
 * Create the OAuth2, this helper will redirect the user
 * to the OAuth2 provider login URL.
 */
app.post('/auth2/google', appwriteAuth2(OAuthProvider.Google,successUrl,failureUrl))

// Success and failure URLs
app.get('/auth2/google/success', appwriteAuth2Save()) // user is logged in and added to the context, optional redirect URL can be sent to the function
app.get('/auth2/google/failure', (c) => c.json({ messsage: '😢  sorry mate' }, 400)) // handle failure


export default app
```

## Available config settings

| Value       | Description                                                  | 
|-------------|--------------------------------------------------------------|
| endpoint    | Appwrite API endpoint e.g. `https://cloud.appwrite.io/v1`    |
| projectId   | Appwrite project ID                                          |
| apiKey      | Appwrite project API key with `sessions.write` scope enabled |
| cookie_name | The cookie that will be set in the user browser              |

## Author

Binyamin Yawitz <https://github.com/byawitz>

## License

MIT
