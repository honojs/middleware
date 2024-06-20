# Effect Schema validator middleware for Hono
The validator middleware using [Effect Schema](https://github.com/Effect-TS/effect/blob/main/packages/schema/README.md) for Hono applications.

This middleware provides a robust way to define schemas and validate data with full type safety and functional error handling.

## Usage

```ts
import { Schema as S } from "@effect/schema"
import { schemaValidator } from "@hono/schema-validator"
import { Effect } from "effect"

const User = S.Struct({
  name: S.String,
  age: S.Number,
})

const UserType = S.Schema.Type<typeof User>

const validate = schemaValidator('json', user)

app.post('/user', validate, (c) => {
  return Effect.gen(function* () {
    const { name, age } = yield* c.valid<SchemaType>()

    // Return a response using Hono's context
    return c.json({
      success: true,
      message: `${name} is ${age} years old.`,
    })
  }).catchError((error) => {
    // Handle errors using Effect's error handling
    return c.text(`Error: ${error.message}`, 400)
  })
})

app.post('/author', schemaValidator('json', schema), (c) => {
  const data = c.valid<S.Schema.Type<typeof schema>>()
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
  schemaValidator('json', schema, (result, c) => {
    if (Either.isLeft(result)) {
      return c.text('Invalid!', 400)
    }
  })
  //...
)
```

## Author

Gunther Brunner <https://github.com/gunta>

## License

MIT
