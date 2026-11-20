# Zod validator middleware for Hono

[![codecov](https://codecov.io/github/honojs/middleware/graph/badge.svg?flag=zod-validator)](https://codecov.io/github/honojs/middleware)

The validator middleware using [Zod](https://zod.dev) for [Hono](https://honojs.dev) applications. You can write a schema with Zod and validate the incoming values.

## Usage

```ts
import * as z from 'zod'
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

### Default error response

If validation fails and no hook is provided, the middleware responds with `400 Bad Request` and the serialized Zod `safeParse` result as the body. For the schema above, sending `{ "name": "a", "age": "x" }` returns:

```json
{
  "success": false,
  "error": {
    "name": "ZodError",
    "message": "[\n  {\n    \"expected\": \"number\",\n    \"code\": \"invalid_type\",\n    \"path\": [\n      \"age\"\n    ],\n    \"message\": \"Invalid input: expected number, received string\"\n  }\n]"
  }
}
```

Note that `error.message` is a JSON string of Zod's issue array, not a nested object. This is the Zod v4 shape; with Zod v3 the same code serializes the issues inline instead (`"error": { "issues": [...], "name": "ZodError" }`). The format is Zod's own serialization and is not guaranteed to be stable across Zod versions. If clients parse the error body, define your own format with a hook (see below).

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

For example, a hook returning an [RFC 9457 Problem Details](https://datatracker.ietf.org/doc/html/rfc9457) body:

```ts
app.post(
  '/post',
  zValidator('json', schema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          type: 'about:blank',
          title: 'Bad Request',
          status: 400,
          detail: 'Request validation failed.',
          errors: result.error.issues.map((issue) => ({
            detail: issue.message,
            pointer: `#/${issue.path.join('/')}`,
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

Throw Error:

throw a zod validate error instead of directly returning an error response.

```ts
// file: validator-wrapper.ts
import * as z from 'zod'
import type { ValidationTargets } from 'hono'
import { zValidator as zv } from '@hono/zod-validator'

export const zValidator = <T extends z.ZodSchema, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T
) =>
  zv(target, schema, (result, c) => {
    if (!result.success) {
      throw new HTTPException(400, { cause: result.error })
    }
  })

// usage
import { zValidator } from './validator-wrapper'
app.post(
  '/post',
  zValidator('json', schema)
  //...
)
```

### Custom validation function

By default, this Validator validates values using `.safeParseAsync`.

```ts
await schema.safeParseAsync(value)
```

But, if you want to use the [`.passthrough`](https://zod.dev/?id=passthrough), you can specify your own function in `validationFunction`.

```ts
app.post(
  '/',
  zValidator('json', schema, undefined, {
    validationFunction: async (schema, value) => {
      return await schema.passthrough().safeParseAsync(value)
    },
  }),
  (c) => {
    // ...
  }
)
```

## Types

### `InferInput`

To infer the input type of a validated target, import `InferInput` from `hono/validator`:

```ts
import type { InferInput } from 'hono/validator'
```

## Author

Yusuke Wada <https://github.com/yusukebe>

## License

MIT
