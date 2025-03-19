# TypeBox validator middleware for Hono

[![codecov](https://codecov.io/github/honojs/middleware/graph/badge.svg?typebox-validator)](https://codecov.io/github/honojs/middleware)

Validator middleware using [TypeBox](https://github.com/sinclairzx81/typebox) for [Hono](https://honojs.dev) applications.
Define your schema with TypeBox and validate incoming requests.

## Usage

No Hook:

```ts
import { tbValidator } from '@hono/typebox-validator'
import { Type as T } from '@sinclair/typebox'

const schema = T.Object({
  name: T.String(),
  age: T.Number(),
})

const route = app.post('/user', tbValidator('json', schema), (c) => {
  const user = c.req.valid('json')
  return c.json({ success: true, message: `${user.name} is ${user.age}` })
})
```

Hook:

```ts
import { tbValidator } from '@hono/typebox-validator'
import { Type as T } from '@sinclair/typebox'

const schema = T.Object({
  name: T.String(),
  age: T.Number(),
})

app.post(
  '/user',
  tbValidator('json', schema, (result, c) => {
    if (!result.success) {
      return c.text('Invalid!', 400)
    }
  })
  //...
)
```

## Author

Curtis Larson <https://github.com/curtislarson>

## License

MIT
