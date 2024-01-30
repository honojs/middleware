# Universal validator middleware for Hono

The validator middleware using [TypeSchema](https://typeschema.com) for [Hono](https://honojs.dev) applications.
You can write a schema with various schema libraries and validate the incoming values.

The preferred validation library must be additionally installed.  
The list of supported validation libraries can be found at [TypeSchema](https://typeschema.com/#coverage).

## Usage

```ts
import { z } from 'zod'
import { schemaValidator, type ValidationError } from '@hono/schema-validator'

const schema = z.object({
  name: z.string(),
  age: z.number(),
})

app.post('/author', schemaValidator('json', schema), (c) => {
  const data = c.req.valid('json')
  return c.json({
    success: true,
    message: `${data.name} is ${data.age}`,
  })
})

app.onError(async (err, c) => {
  if (err instanceof ValidationError) {
    return c.json(err, err.status)
  }
  return c.text('Internal Server Error', 500)
})
```

Hook:

```ts
app.post(
  '/post',
  schemaValidator('json', schema, (result, c) => {
    if (!result.success) {
      return c.text('Invalid!', 400)
    }
  })
  //...
)
```

## Author

Sebastian Wessel <https://github.com/sebastianwessel>

## License

MIT
