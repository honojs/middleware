# OpenID Connect Authentication middleware for Hono

This is an OpenID Connect (OIDC) authentication third-party middleware for [Hono](https://github.com/honojs/hono), which depends on [oauth4webapi](https://www.npmjs.com/package/oauth4webapi).

This middleware provides storage-less login sessions.

## How does it work?

1. The middleware checks if the session cookie exists.
2. If the session cookie does not exist, the middleware redirects the user to the IdP's authentication endpoint.
3. The user is authenticated by the IdP, then the IdP redirects the user back to the application.
4. The middleware exchanges the authorization code for a refresh token and generates a session cookie as a JWT token. The token is signed with a symmetric key and verified at the edge, making it tamper-proof.
5. The middleware sends a session cookie to the user's browser with a Set-Cookie header.
6. The browser sends the session cookie with each request and the middleware validates the session.
7. After the refresh interval (default set to 15 minutes), the middleware implicitly accesses the IdP's token endpoint using the refresh token to verify that the user is still authenticated and regenerates the session cookie.
8. If the session is expired (default set to 1 day), the middleware revokes the refresh token and redirects the user to the IdP's authentication endpoint. Continue to step 3.

## Supported Identity Providers (IdPs)

This middleware requires the following features for the IdP:

- Supports OpenID Connect
- Provides the discovery endpoint
- Provides the refresh token

Here is a list of the IdPs that I have tested:

| IdP Name    | OpenID issuer URL                                         |
| ----------- | --------------------------------------------------------- |
| Auth0       | `https://<tenant>.<region>.auth0.com`                     |
| AWS Cognito | `https://cognito-idp.<region>.amazonaws.com/<userPoolID>` |
| GitLab      | `https://gitlab.com`                                      |
| Google      | `https://accounts.google.com`                             |
| Slack       | `https://slack.com`                                       |

## Installation

```plain
npm i hono @hono/oidc-auth
```

## Configuration

The middleware requires the following variables to be set as either environment variables or by calling `setOidcAuthEnv`:

| Variable                   | Description                                                                                                                                                       | Default Value                          |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| OIDC_AUTH_SECRET           | The secret key used for signing the session JWT. It is used to verify the JWT in the cookie and prevent tampering. (Must be at least 32 characters long)          | None, must be provided                 |
| OIDC_AUTH_REFRESH_INTERVAL | The interval (in seconds) at which the session should be implicitly refreshed.                                                                                    | 15 \* 60 (15 minutes)                  |
| OIDC_AUTH_EXPIRES          | The interval (in seconds) after which the session should be considered expired. Once expired, the user will be redirected to the IdP for re-authentication.       | 60 _ 60 _ 24 (1 day)                   |
| OIDC_ISSUER                | The issuer URL of the OpenID Connect (OIDC) discovery. This URL is used to retrieve the OIDC provider's configuration.                                            | None, must be provided                 |
| OIDC_CLIENT_ID             | The OAuth 2.0 client ID assigned to your application. This ID is used to identify your application to the OIDC provider.                                          | None, must be provided                 |
| OIDC_CLIENT_SECRET         | The OAuth 2.0 client secret assigned to your application. This secret is used to authenticate your application to the OIDC provider.                              | None, must be provided                 |
| OIDC_REDIRECT_URI          | The URL to which the OIDC provider should redirect the user after authentication. This URL must be registered as a redirect URI in the OIDC provider.             | `/callback`                            |
| OIDC_SCOPES                | The scopes that should be used for the OIDC authentication                                                                                                        | The server provided `scopes_supported` |
| OIDC_COOKIE_PATH           | The path to which the `oidc-auth` cookie is set. Restrict to not send it with every request to your domain                                                        | /                                      |
| OIDC_COOKIE_NAME           | The name of the cookie to be set                                                                                                                                  | `oidc-auth`                            |
| OIDC_COOKIE_DOMAIN         | The custom domain of the cookie. For example, set this like `example.com` to enable authentication across subdomains (e.g., `a.example.com` and `b.example.com`). | Domain of the request                  |

## How to Use

```typescript
import { Hono } from 'hono'
import { oidcAuthMiddleware, getAuth, revokeSession, processOAuthCallback } from '@hono/oidc-auth'
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
import { oidcAuthMiddleware, getAuth } from '@hono/oidc-auth'

const app = new Hono()

app.use('*', oidcAuthMiddleware())
app.get('*', async (c) => {
  const auth = await getAuth(c)
  if (!auth?.email.endsWith('@example.com')) {
    return c.text('Unauthorized', 401)
  }
  const response = await c.env.ASSETS.fetch(c.req.raw)
  // clone the response to return a response with modifiable headers
  const newResponse = new Response(response.body, response)
  return newResponse
})

export default app
```

## Using original response or additional claims

```typescript
import type { IDToken, OidcAuth, TokenEndpointResponses } from '@hono/oidc-auth';
import { processOAuthCallback } from '@hono/oidc-auth';
import type { Context, OidcAuthClaims } from 'hono';

declare module 'hono' {
  interface OidcAuthClaims {
    name: string
    sub: string
  }
}

const oidcClaimsHook = async (orig: OidcAuth | undefined, claims: IDToken | undefined, _response: TokenEndpointResponses): Promise<OidcAuthClaims> => {
  /*
  const { someOtherInfo } = await fetch(c.get('oidcAuthorizationServer').userinfo_endpoint, {
    header: _response.access_token
  }).then((res) => res.json())
  */
  return {
    name: claims?.name as string ?? orig?.name ?? '',
    sub: claims?.sub ?? orig?.sub ?? ''
  };
}),
...
app.get('/callback', async (c) => {
  c.set('oidcClaimsHook', oidcClaimsHook); // also assure to set before any getAuth(), in case the token is refreshed
  return processOAuthCallback(c);
})
...
```

Note:
If explicit logout is not required, the logout handler can be omitted.
If the middleware is applied to the callback URL, the default callback handling in the middleware can be used, so the explicit callback handling is not required.

## Programmatically configure auth variables

```typescript
// Before other oidc-auth APIs are used
app.use(async (c, next) => {
  let config = {
    // Configure auth variables
  }
  setOidcAuthEnv(c, config)
  await next()
});
```

## Author

Yoshio HANAWA <https://github.com/hnw>

## License

MIT
