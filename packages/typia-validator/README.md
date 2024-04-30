# Typia validator middleware for Hono

The validator middleware using [Typia](https://typia.io/docs/) for [Hono](https://honojs.dev) applications.

## Usage

```ts
import typia, { tags } from 'typia'
import { typiaValidator } from '@hono/typia-validator'

interface Author {
    name: string
    age: number & tags.Type<'uint32'> & tags.Minimum<20> & tags.ExclusiveMaximum<100>
  }

  const validate = typia.createValidate<Author>()

  const route = app.post('/author', typiaValidator('json', validate), (c) => {
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
  typiaValidator('json', validate, (result, c) => {
    if (!result.success) {
      return c.text('Invalid!', 400)
    }
  })
  //...
)
```

## Author

Patryk Dwórznik <https://github.com/dworznik>

## License

MIT
