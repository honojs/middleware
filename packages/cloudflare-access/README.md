# Cloudflare Access middleware for Hono

[![codecov](https://codecov.io/github/honojs/middleware/graph/badge.svg?flag=cloudflare-access)](https://codecov.io/github/honojs/middleware)

This is a [Cloudflare Access](https://www.cloudflare.com/zero-trust/products/access/) third-party middleware
for [Hono](https://github.com/honojs/hono).

This middleware can be used to validate that your application is being served behind Cloudflare Access by verifying the
JWT received, User details from the JWT are also available inside the request context.

This middleware will also ensure the Access policy serving the application is from a
specific [Access Team](https://developers.cloudflare.com/cloudflare-one/faq/getting-started-faq/#whats-a-team-domainteam-name). It is strongly recommended to pass your [Application Audience (AUD) Tag](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/#get-your-aud-tag) to validate that the JWT was intended for your specific application to prevent cross-application token reuse.

## Usage

```ts
import { cloudflareAccess } from '@hono/cloudflare-access'
import { Hono } from 'hono'

const app = new Hono()

app.use('*', cloudflareAccess('my-access-team-name', 'my-application-aud-tag'))
app.get('/', (c) => c.text('foo'))

export default app
```

The `aud` parameter is optional for backwards compatibility, but omitting it is discouraged in production.

## Access JWT payload

```ts
import { cloudflareAccess, CloudflareAccessVariables } from '@hono/cloudflare-access'
import { Hono } from 'hono'

type myVariables = {
  user: number
}

const app = new Hono<{ Variables: myVariables & CloudflareAccessVariables }>()

app.use('*', cloudflareAccess('my-access-team-name'))
app.get('/', (c) => {
  const payload = c.get('accessPayload')

  return c.text(`You just authenticated with the email ${payload.email}`)
})

export default app
```

## Errors throw by the middleware

| Error                                                                          | HTTP Code |
| ------------------------------------------------------------------------------ | --------- |
| Authentication error: Missing bearer token                                     | 401       |
| Authentication error: Unable to decode bearer token                            | 401       |
| Authentication error: Invalid token algorithm                                  | 401       |
| Authentication error: Malformed token payload                                  | 401       |
| Authentication error: Token is expired                                         | 401       |
| Authentication error: Token is not yet valid                                   | 401       |
| Authentication error: Invalid token                                            | 401       |
| Authentication error: Invalid team name                                        | 401       |
| Authentication error: Invalid token audience                                   | 401       |
| Invalid accessTeamName: must contain only alphanumeric characters and hyphens  | (throws)  |
| Authentication error: The Access Organization 'my-team-name' does not exist    | 500       |
| Authentication error: Received unexpected HTTP code 500 from Cloudflare Access | 500       |

## Author

Gabriel Massadas <https://github.com/g4brym>

## License

MIT
