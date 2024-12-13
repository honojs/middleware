# Standard Schema validator middleware for Hono

The validator middleware using [Standard Schema Spec](https://github.com/standard-schema/standard-schema) for [Hono](https://honojs.dev) applications.
You can write a schema with any validation library supporting Standard Schema and validate the incoming values.

## Usage

```ts
import { z } from 'zod'
import { sValidator } from '@hono/standard-schema-validator'

const zod = z.object({
  name: z.string(),
  age: z.number(),
});

app.post('/author', sValidator('json', schema), (c) => {
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
  sValidator('json', schema, (result, c) => {
    if (!result.success) {
      return c.text('Invalid!', 400)
    }
  })
  //...
)
```

## Author

Rokas Muningis <https://github.com/muningis>

## License

MIT
