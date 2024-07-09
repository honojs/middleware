# Effect Schema Validator Middleware for Hono

This package provides a validator middleware using [Effect Schema](https://github.com/Effect-TS/effect/blob/main/packages/schema/README.md) for [Hono](https://honojs.dev) applications. With this middleware, you can define schemas using Effect Schema and validate incoming data in your Hono routes.

## Why Effect Schema?

Effect Schema offers several advantages over other validation libraries:

1. Bidirectional transformations: Effect Schema can both decode and encode data.
2. Integration with Effect: It inherits benefits from the Effect ecosystem, such as dependency tracking in transformations.
3. Highly customizable: Users can attach meta-information through annotations.
4. Functional programming style: Uses combinators and transformations for schema definition.


## Usage

```ts
import { Schema as S } from "@effect/schema"
import { effectValidator } from "@hono/effect-validator"
import { Effect } from "effect"

const app = new Hono()

const User = S.Struct({
  name: S.String,
  age: S.Number,
})

app.post(
    '/user',
    effectValidator('json', User),
    (c) => {
      const user = c.req.valid('json') as S.Schema.Type<typeof User>

      return c.json({
        success: true,
        message: `${user.name} is ${user.age}`
      })
    }
  )
```

## API

### `effectValidator(target, schema)`

- `target`: The target of validation ('json', 'form', 'query', etc.)
- `schema`: An Effect Schema schema


## Author

Günther Brunner <https://github.com/gunta>

## License

MIT
