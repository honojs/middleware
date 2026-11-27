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

## Problem Details

To respond with an [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) Problem Details body instead, pass `problemDetailsHook()` to `sValidator`:

```ts
import * as z from 'zod'
import { problemDetailsHook, sValidator } from '@hono/standard-validator'

const schema = z.object({
  name: z.string().min(1),
  'owner/id': z.string(),
  tags: z.array(z.string()),
})

app.post('/pets', sValidator('json', schema, problemDetailsHook()), (c) =>
  c.json(c.req.valid('json'), 201)
)
```

A request with `{ "name": "", "owner/id": 5, "tags": ["indoor", 1] }` then gets a `400` response with `Content-Type: application/problem+json`:

```json
{
  "type": "about:blank",
  "title": "Bad Request",
  "status": 400,
  "detail": "The request did not pass validation.",
  "errors": [
    { "detail": "Too small: expected string to have >=1 characters", "pointer": "/name" },
    { "detail": "Invalid input: expected string, received number", "pointer": "/owner~1id" },
    { "detail": "Invalid input: expected string, received number", "pointer": "/tags/1" }
  ]
}
```

Each `pointer` is a [JSON Pointer (RFC 6901)](https://www.rfc-editor.org/rfc/rfc6901) into the validated target, so for `form`, `header`, `param` and `query` it points into the parsed values rather than the raw request. An issue without a path points to the whole target (`""`), and one whose path has a key a JSON document can't have, like a symbol, has no `pointer`.

To build the response yourself, for example to add an `instance` member, use `problemDetails` inside a hook:

```ts
import { problemDetails, sValidator } from '@hono/standard-validator'

app.post(
  '/pets',
  sValidator('json', schema, (result, c) => {
    if (!result.success) {
      return c.json({ ...problemDetails(result.error), instance: c.req.path }, 400, {
        'Content-Type': 'application/problem+json',
      })
    }
  }),
  (c) => {
    // ...
  }
)
```

## Author

Rokas Muningis <https://github.com/muningis>

## License

MIT
