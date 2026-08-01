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

### Default error response

If validation fails and no hook is provided, the middleware responds with `400 Bad Request`. The body contains the original input (`data`) and the schema library's issues (`error`). For the schema above, sending `{ "name": "a", "age": "x" }` returns:

```json
{
  "data": {
    "name": "a",
    "age": "x"
  },
  "error": [
    {
      "expected": "number",
      "code": "invalid_type",
      "path": ["age"],
      "message": "Invalid input: expected number, received string"
    }
  ],
  "success": false
}
```

The issue objects in `error` come from the underlying schema library (Zod in this example), so their fields vary by library and are not guaranteed to be stable. Also note that `data` echoes the raw request input back to the client. If that is undesirable (for example, the request may contain sensitive values) or clients parse the error body, define your own format with a hook. For example, an [RFC 9457 Problem Details](https://datatracker.ietf.org/doc/html/rfc9457) body:

```ts
app.post(
  '/post',
  sValidator('json', schema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          type: 'about:blank',
          title: 'Bad Request',
          status: 400,
          detail: 'Request validation failed.',
          errors: result.error.map((issue) => ({
            detail: issue.message,
            pointer: `#/${(issue.path ?? [])
              .map((p) => (typeof p === 'object' ? String(p.key) : String(p)))
              .join('/')}`,
          })),
        },
        400,
        { 'content-type': 'application/problem+json' }
      )
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

## Author

Rokas Muningis <https://github.com/muningis>

## License

MIT
