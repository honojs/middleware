# Valibot validator middleware for Hono

[![codecov](https://codecov.io/github/honojs/middleware/graph/badge.svg?flag=valibot-validator)](https://codecov.io/github/honojs/middleware)

The validator middleware using [Valibot](https://valibot.dev) for [Hono](https://honojs.dev) applications.
You can write a schema with Valibot and validate the incoming values.

## Usage

```ts
import * as v from 'valibot'
import { vValidator } from '@hono/valibot-validator'

const schema = v.object({
  name: v.string(),
  age: v.number(),
})

app.post('/author', vValidator('json', schema), (c) => {
  const data = c.req.valid('json')
  return c.json({
    success: true,
    message: `${data.name} is ${data.age}`,
  })
})
```

Hook:

```ts
app.post(
  '/post',
  vValidator('json', schema, (result, c) => {
    if (!result.success) {
      return c.text('Invalid!', 400)
    }
  })
  //...
)
```

## Author

Nico Franke <https://github.com/ZerNico>

## License

MIT
