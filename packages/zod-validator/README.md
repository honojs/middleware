# Zod validator middleware for Hono

The validator middleware using [Zod](https://zod.dev) for [Hono](https://honojs.dev) applications.
You can write a schema with Zod and validate the incoming values.

## Usage

```ts
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'

const schema = z.object({
  name: z.string(),
  age: z.number(),
})

app.post('/author', zValidator('json', schema), (c) => {
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
  zValidator('json', schema, (result, c) => {
    if (!result.success) {
      return c.text('Invalid!', 400)
    }
  })
  //...
)
```

## Author

Yusuke Wada <https://github.com/yusukebe>

## License

MIT
