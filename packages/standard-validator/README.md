# Standard Schema validator middleware for Hono

[![codecov](https://codecov.io/github/honojs/middleware/graph/badge.svg?flag=standard-validator)](https://codecov.io/github/honojs/middleware)

The validator middleware using [Standard Schema Spec](https://github.com/standard-schema/standard-schema) for [Hono](https://honojs.dev) applications.
You can write a schema with any validation library supporting Standard Schema and validate the incoming values.

## Usage

### Basic:

```ts
import * as z from 'zod'
import { sValidator } from '@hono/standard-validator'

const schema = z.object({
  name: z.string(),
  age: z.number(),
})

app.post('/author', sValidator('json', schema), (c) => {
  const data = c.req.valid('json')
  return c.json({
    success: true,
    message: `${data.name} is ${data.age}`,
  })
})
```

### Hook:

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

### Headers:

Headers are internally transformed to lower-case in Hono. Hence, you will have to make them lower-cased in validation object.

```ts
import * as v from 'valibot'
import { sValidator } from '@hono/standard-validator'

const schema = v.object({
  'content-type': v.string(),
  'user-agent': v.string(),
})

app.post('/author', sValidator('header', schema), (c) => {
  const headers = c.req.valid('header')
  // do something with headers
})
```

## Types

### `InferInput`

To infer the input type of a validated target, import `InferInput` from `hono/validator`:

```ts
import type { InferInput } from 'hono/validator'
```

## Grouping errors

This validator returns ungrouped errors, which can be inconvenient when mapping errors to form fields:

```json
{
  "data": {
    "name": "john doe",
    "age": "twenty",
    "role": "admin"
  },
  "error": [
    {
      "origin": "string",
      "code": "too_big",
      "maximum": 4,
      "inclusive": true,
      "path": ["name"],
      "message": "Name is too long"
    },
    {
      "origin": "string",
      "code": "invalid_format",
      "format": "regex",
      "pattern": "/^[0-9A-Za-z_]+$/",
      "path": ["name"],
      "message": "Name must only contain alphanumeric characters"
    },
    {
      "expected": "number",
      "code": "invalid_type",
      "path": ["age"],
      "message": "Age must be a number"
    },
    {
      "code": "unrecognized_keys",
      "keys": ["role"],
      "path": [],
      "message": "Unrecognized key: \"role\""
    }
  ],
  "success": false
}
```

To group them, use `flattenErrors` inside a `sValidator` hook:

```ts
import { flattenErrors, sValidator } from '@hono/standard-validator'

// ...schema

app.post(
  '/author',
  sValidator('json', schema, (result, c) => {
    if (!result.success) {
      return c.json(flattenErrors(result.error), 400)
    }
  }),
  (c) => {
    // ...
  }
)
```

Now, error messages are grouped by field as arrays under the `fieldErrors` property. As for unknown keys or root-level issues, they go inside `fieldErrors` or `formErrors`, depending on the validation library you use:

```jsonc
// Zod
{
  "formErrors": ["Unrecognized key: \"role\""],
  "fieldErrors": {
    "name": ["Name is too long", "Name must only contain alphanumeric characters"],
    "age": ["Age must be a number"],
  },
}

// Valibot
{
  "formErrors": [],
  "fieldErrors": {
    "name": ["Name is too long", "Name must only contain alphanumeric characters"],
    "age": ["Age must be a number"],
    "role": ["Invalid key: Expected never but received \"role\""]
  },
}
```

## Author

Rokas Muningis <https://github.com/muningis>

## License

MIT
