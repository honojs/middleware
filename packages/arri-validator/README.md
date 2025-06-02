# Arri validator middleware for Hono

Validator middleware for [Hono](https://honojs.dev) applications which uses [Arri Schema](https://github.com/modiimedia/arri). You can write a schema with Arri and validate the incoming values.

## Usage

```ts
import { a } from '@arrirpc/schema'
import { aValidator } from '@hono/arri-validator'

const schema = a.object({
  name: a.string(),
  age: a.number(),
})

app.post('/author', aValidator('json', schema), (c) => {
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
  aValidator('json', schema, (result, c) => {
    if (!result.success) {
      return c.text('Invalid!', 400)
    }
  })
  //...
)
```

Throw Error:

To throw an error instead of directly returning an error response, you can create a custom wrapper for the validator. You could also create a custom validation function which uses `a.parseUnsafe`.

```ts
// file: validator-wrapper.ts
import type { ASchema } from '@arrirpc/schema'
import type { ValidationTargets } from 'hono'
import { aValidator as av } from '@hono/arri-validator'

export const aValidator = <T extends ASchema, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T
) =>
  av(target, schema, (result, c) => {
    if (!result.success) {
      throw new HTTPException(400, { cause: result.errors })
    }
  })

// usage
import { aValidator } from './validator-wrapper'
app.post(
  '/post',
  aValidator('json', schema)
  //...
)
```

### Custom validation function

By default, this validation is done using `a.parse`.

```ts
await a.parse(schema, value)
```

If you want to use the [`a.coerce`](https://github.com/modiimedia/arri/blob/master/languages/ts/ts-schema/README.md#coerce), you can specify your own function in `validationFunction`.

```ts
app.post(
  '/',
  aValidator('json', schema, undefined, {
    validationFunction: (schema, value) => {
      return a.coerce(schema, value)
    },
  }),
  (c) => {
    // ...
  }
)
```

## Author

kalucky0 <https://github.com/kalucky0>

## License

MIT
