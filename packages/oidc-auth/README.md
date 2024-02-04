# OpenID Connect Authentication middleware for Hono

This is an OpenID Connect (OIDC) authentication third-party middleware for [Hono](https://github.com/honojs/hono), which depends on [oauth4webapi](https://www.npmjs.com/package/oauth4webapi).

This middleware provides storage-less login sessions.

## How does it work?

1. The middleware checks if the session cookie exists.
2. If the session cookie does not exist, the middleware redirects the user to the IdP's authentication endpoint.
3. The user authenticates with the IdP and the IdP redirects the user back to the application.
4. The middleware exchanges the authorization code for a refresh token and generates a session cookie as a JWT token. The token is signed with a symmetric key and verified at the edge, making it tamper-proof.
5. The middleware sets the session cookie and continues the request.
6. The middleware implicitly refreshes the session cookie after a brief period (default set to 15 minutes) for security reasons. If a security incident occures, the refresh token can be invalidated from the IdP's console and the session should expire in shortly.

## Supported Identity Providers (IdPs)

This middleware requires the following features for the IdP:

- Supports OpenID Connect
- Provides the discovery endpoint
- Provides the refresh token

Here is a list of the IdPs that I have tested:

| IdP Name | OpenID issuer URL |
| ---- | ---- |
| Auth0       | `https://<tenant name>.<region name>.auth0.com` |
| AWS Cognito | `https://cognito-idp<region name>.amazonaws.com/<user pool ID>` |
| GitLab      | `https://gitlab.com` |
| Google      | `https://accounts.google.com` |
| Slack       | `https://slack.com` |

## Installation

```plain
npm i hono @hono/oidc-auth
```

## Configuration

The OIDC authentication middleware requires the following configuration:

| Key | Description | Default Value |
| ---- | ---- | ---- |
| sessionSecret          | The secret key used for signing the session JWT. It is used to verify the JWT in the cookie and prevent tampering. | None, must be provided |
| sessionRefreshInterval | The interval (in seconds) at which the session should be implicitly refreshed. | 15 * 60 (15 minutes) |
| sessionExpires         | The interval (in seconds) after which the session should be considered expired. Once expired, the user will be redirected to the IdP for re-authentication. | 60 * 60 * 24 (1 day) |
| issuer                 | The issuer URL of the OpenID Connect (OIDC) discovery. This URL is used to retrieve the OIDC provider's configuration. | None, must be provided |
| clientId               | The OAuth 2.0 client ID assigned to your application. This ID is used to identify your application to the OIDC provider. | None, must be provided |
| clientSecret           | The OAuth 2.0 client secret assigned to your application. This secret is used to authenticate your application to the OIDC provider. | None, must be provided |
| redirectUri            | The URL to which the OIDC provider should redirect the user after authentication. This URL must be registered as a redirect URI in the OIDC provider. | None, must be provided |

These parameters can be set using the `configureOidcAuth()` function.

## How to Use

```typescript
import { Hono } from 'hono'
import { configureOidcAuth, oidcAuthMiddleware, getAuth, revokeSession, processOAuthCallback } from '@hono/oidc-auth';

configureOidcAuth({
  issuer: 'https://openid-issuer-url.example.com',
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  redirectUri: 'https://example.com/callback',
  sessionSecret: 'StringThatMustBeAtLeast32Characters',
})
const app = new Hono()

app.get('/logout', async (c) => {
  await revokeSession(c)
  return c.text('You have been successfully logged out!')
})
app.get('/callback', async (c) => {
  return processOAuthCallback(c)
})
app.use('*', oidcAuthMiddleware())
app.get('/', async (c) => {
  const auth = await getAuth(c)
  return c.text(`Hello <${auth?.email}>!`)
})

export default app
```

## Another example: Cloudflare Pages with OpenID connect login

```typescript
import { Hono } from 'hono'
import { configureOidcAuth, oidcAuthMiddleware, getAuth } from '@hono/oidc-auth';

configureOidcAuth({
  issuer: 'https://openid-issuer-url.example.com',
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  redirectUri: 'https://example.com/callback',
  sessionSecret: 'StringThatMustBeAtLeast32Characters',
})
const app = new Hono()

app.use('*', oidcAuthMiddleware())
app.get('*', async (c) => {
  const auth = await getAuth(c)
  if (!auth?.email.endsWith('@example.com')) {
    return c.text('Unauthorized', 401)
  }
  const response = await c.env.ASSETS.fetch(c.req.raw);
  // clone the response to return a response with modifiable headers
  const newResponse = new Response(response.body, response)
  return newResponse
});

export default app
```

Note:
If explicit logout is not required, the logout handler can be omitted.
If the middleware is applied to the callback URL, the default callback handling in the middleware can be used, so the explicit callback handling is not required.

## Author

Yoshio HANAWA <https://github.com/hnw>

## License

MIT
