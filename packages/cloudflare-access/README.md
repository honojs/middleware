# Cloudflare Access middleware for Hono

[![codecov](https://codecov.io/github/honojs/middleware/graph/badge.svg?flag=cloudflare-access)](https://codecov.io/github/honojs/middleware)

This is a [Cloudflare Access](https://www.cloudflare.com/zero-trust/products/access/) third-party middleware
for [Hono](https://github.com/honojs/hono).

This middleware can be used to validate that your application is being served behind Cloudflare Access by verifying the
JWT received, User details from the JWT are also available inside the request context.

This middleware will also ensure the Access policy serving the application is from a
specific [Access Team](https://developers.cloudflare.com/cloudflare-one/faq/getting-started-faq/#whats-a-team-domainteam-name).

## Usage

```ts
import { cloudflareAccess } from '@hono/cloudflare-access'
import { Hono } from 'hono'

const app = new Hono()

app.use('*', cloudflareAccess('my-access-team-name'))
app.get('/', (c) => c.text('foo'))

export default app
```

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

| Error                                                                                                  | HTTP Code |
| ------------------------------------------------------------------------------------------------------ | --------- |
| Authentication error: Missing bearer token                                                             | 401       |
| Authentication error: Unable to decode Bearer token                                                    | 401       |
| Authentication error: Token is expired                                                                 | 401       |
| Authentication error: Expected team name {your-team-name}, but received ${different-team-signed-token} | 401       |
| Authentication error: Invalid Token                                                                    | 401       |
| Authentication error: The Access Organization 'my-team-name' does not exist                            | 500       |
| Authentication error: Received unexpected HTTP code 500 from Cloudflare Access                         | 500       |

## Author

Gabriel Massadas <https://github.com/g4brym>

## License

MIT
