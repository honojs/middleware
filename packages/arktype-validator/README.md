# ArkType validator middleware for Hono

[![codecov](https://codecov.io/github/honojs/middleware/graph/badge.svg?flag=arktype-validator)](https://codecov.io/github/honojs/middleware)

The validator middleware using [ArkType](https://arktype.io/) for [Hono](https://honojs.dev) applications.
You can write a schema with ArkType and validate the incoming values.

## Usage

```ts
import { type } from 'arktype'
import { arktypeValidator } from '@hono/arktype-validator'

const schema = type({
  name: 'string',
  age: 'number',
})

app.post('/author', arktypeValidator('json', schema), (c) => {
  const data = c.req.valid('json')
  return c.json({
    success: true,
    message: `${data.name} is ${data.age}`,
  })
})
```

### With hook:

```ts
app.post(
  '/post',
  arktypeValidator('json', schema, (result, c) => {
    if (!result.success) {
      return c.text('Invalid!', 400)
    }
  })
  //...
)
```

## Author

Andrei Bobkov <https://github.com/MonsterDeveloper>

## License

MIT
