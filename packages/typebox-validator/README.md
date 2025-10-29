# TypeBox validator middleware for Hono

[![codecov](https://codecov.io/github/honojs/middleware/graph/badge.svg?typebox-validator)](https://codecov.io/github/honojs/middleware)

Validator middleware using [TypeBox](https://github.com/sinclairzx81/typebox) for [Hono](https://honojs.dev) applications.
Use TypeBox or JSON Schema to validate incoming requests.

## TypeBox

No Hook:

```ts
import { tbValidator } from '@hono/typebox-validator'
import Type from 'typebox'

const User = Type.Object({
  name: Type.String(),
  age: Type.Number(),
})

const route = app.post('/user', tbValidator('json', User), (c) => {
  const user = c.req.valid('json')
  return c.json({ success: true, message: `${user.name} is ${user.age}` })
})
```

Hook:

```ts
import { tbValidator } from '@hono/typebox-validator'
import Type from 'typebox'

const User = Type.Object({
  name: Type.String(),
  age: Type.Number(),
})

app.post(
  '/user',
  tbValidator('json', User, (result, c) => {
    if (!result.success) {
      return c.text('Invalid!', 400)
    }
  })
  //...
)
```

## JSON Schema

JSON Schema validation and inference is supported.

```typescript
import { tbValidator } from '@hono/typebox-validator'

const route = app.post(
  '/user',
  tbValidator('json', {
    type: 'object',
    required: ['name', 'age'],
    properties: {
      name: { type: 'string' },
      age: { type: 'number' },
    },
  }),
  (c) => {
    const user = c.req.valid('json')
    return c.json({ success: true, message: `${user.name} is ${user.age}` })
  }
)
```

## Author

Curtis Larson <https://github.com/curtislarson>

## License

MIT
