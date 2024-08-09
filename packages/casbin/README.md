# Casbin Middleware for Hono

This is a [Casbin](https://casbin.org) third-party middleware for [Hono](https://github.com/honojs/hono).

This middleware can be used to enforce authorization policies defined using Casbin in your Hono routes.

## Installation

```bash
npm i hono @hono/casbin casbin
```

## Configuration
Before using the middleware, you must set up your Casbin model and policy files.

For how to write authorization policy and other details, please refer to the [Casbin's documentation](https://casbin.org/).

- example model.conf
```conf
[request_definition]
r = sub, obj, act

[policy_definition]
p = sub, obj, act

[role_definition]
g = _, _

[policy_effect]
e = some(where (p.eft == allow))

[matchers]
m = r.sub == p.sub && r.obj == p.obj && r.act == p.act
```

- example policy.csv
```csv
p, alice, /dataset1/*, GET
p, bob, /dataset2/folder1/*, POST
g, cathy, dataset1_admin
p, dataset1_admin, /dataset1/*, *
```

## Usage with Basic HTTP Authentication

By default, the casbin middleware supports HTTP Basic Authentication of the form `Authentication: Basic {Base64Encoded(username:password)}.`

```ts
import { Hono } from 'hono';
import { newEnforcer } from 'casbin';
import { casbin } from '@hono/cabin';

const app = new Hono();
app.use('*', casbin({ newEnforcer: newEnforcer('path-to-your-model.conf', 'path-to-your-policy.csv') }));
app.get('/dataset1/test', (c) => c.text('dataset1 test'));
// Only alice can access /dataset1/test
```

## Usage with Customized Authorizer

You can also use a customized authorizer function to handle the authorization logic.

```ts
import { Hono } from 'hono';
import { newEnforcer } from 'casbin';
import { casbin } from '@hono/cabin';

const app = new Hono();
app.use('*', casbin({
  newEnforcer: newEnforcer('path-to-your-model.conf', 'path-to-your-policy.csv'),
  authorizer: async (c, enforcer) => {
    const { user, path, method } = c;
    return await enforcer.enforce(user, path, method);
  }
}));
```


## Author
sugar-cat https://github.com/sugar-cat7
