# Casbin Middleware for Hono

[![codecov](https://codecov.io/github/honojs/middleware/graph/badge.svg?flag=casbin)](https://codecov.io/github/honojs/middleware)

This is a third-party [Casbin](https://casbin.org) middleware for [Hono](https://github.com/honojs/hono).

This middleware can be used to enforce authorization policies defined using Casbin in your Hono routes.

## Installation

```bash
npm i hono @hono/casbin casbin
```

## Configuration

Before using the middleware, you must set up your Casbin model and policy files.

For details on how to write authorization policies and other information, please refer to the [Casbin documentation](https://casbin.org/).

### Example model.conf

```conf
[request_definition]
r = sub, obj, act

[policy_definition]
p = sub, obj, act

[policy_effect]
e = some(where (p.eft == allow))

[matchers]
m = r.sub == p.sub && keyMatch(r.obj, p.obj) && (r.act == p.act || p.act == "*")
```

### Example policy.csv

```csv
p, alice, /dataset1/*, *
p, bob, /dataset1/*, GET
```

## Usage with Basic HTTP Authentication

You can perform authorization control after Basic authentication by combining it with `basicAuthorizer`.
(The client needs to send `Authentication: Basic {Base64Encoded(username:password)}`.)

Let's look at an example.
Use the `model` and `policy` files from the [Configuration](#configuration) section.
You can implement a scenario where `alice` and `bob` have different permissions. Alice has access to all methods on `/dataset1/test`, while Bob has access only to the `GET` method.

```ts
import { Hono } from 'hono'
import { basicAuth } from 'hono/basic-auth'
import { newEnforcer } from 'casbin'
import { casbin } from '@hono/casbin'
import { basicAuthorizer } from '@hono/casbin/helper'

const app = new Hono()
app.use(
  '*',
  basicAuth(
    {
      username: 'alice', // alice has full access to /dataset1/test
      password: 'password',
    },
    {
      username: 'bob', // bob cannot post to /dataset1/test
      password: 'password',
    }
  ),
  casbin({
    newEnforcer: newEnforcer('examples/model.conf', 'examples/policy.csv'),
    authorizer: basicAuthorizer,
  })
)
app.get('/dataset1/test', (c) => c.text('dataset1 test')) // alice and bob can access /dataset1/test
app.post('/dataset1/test', (c) => c.text('dataset1 test')) // Only alice can access /dataset1/test
```

## Usage with JWT Authentication

By using `jwtAuthorizer`, you can perform authorization control after JWT authentication.
By default, `jwtAuthorizer` uses the `sub` in the JWT payload as the username.

```ts
import { Hono } from 'hono'
import { jwt } from 'hono/jwt'
import { newEnforcer } from 'casbin'
import { casbin } from '@hono/casbin'
import { jwtAuthorizer } from '@hono/casbin/helper'

const app = new Hono()
app.use(
  '*',
  jwt({
    secret: 'it-is-very-secret',
  }),
  casbin({
    newEnforcer: newEnforcer('examples/model.conf', 'examples/policy.csv'),
    authorizer: jwtAuthorizer,
  })
)
app.get('/dataset1/test', (c) => c.text('dataset1 test')) // alice and bob can access /dataset1/test
app.post('/dataset1/test', (c) => c.text('dataset1 test')) // Only alice can access /dataset1/test
```

Of course, you can use claims other than the `sub` claim.
Specify the `key` as a user-friendly name and the `value` as the JWT claim name. The `Payload` key used for evaluation in the enforcer will be the `value`.

```ts
const claimMapping = {
  username: 'username',
}
// ...
casbin({
  newEnforcer: newEnforcer('examples/model.conf', 'examples/policy.csv'),
  authorizer: (c, e) => jwtAuthorizer(c, e, claimMapping),
})
```

## Usage with Customized Authorizer

You can also use a customized authorizer function to handle the authorization logic.

```ts
import { Hono } from 'hono'
import { newEnforcer } from 'casbin'
import { casbin } from '@hono/casbin'

const app = new Hono()
app.use(
  '*',
  casbin({
    newEnforcer: newEnforcer('path-to-your-model.conf', 'path-to-your-policy.csv'),
    authorizer: async (c, enforcer) => {
      const { user, path, method } = c
      return await enforcer.enforce(user, path, method)
    },
  })
)
```

## Author

sugar-cat https://github.com/sugar-cat7
