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

### Synchronous parsing and compiled schemas

Use `.safeParse()` through `validationFunction` to enable [compiled parsing](https://zod.dev/compile) for synchronous schemas.
The default `.safeParseAsync()` bypasses compilation. This example uses Zod 4.6:

```ts
import { Hono } from 'hono'
import * as z from 'zod'
import { zValidator } from '@hono/zod-validator'

const app = new Hono()
const schema = z.compile(
  z.object({
    name: z.string(),
    age: z.number(),
  })
)

app.post(
  '/author',
  zValidator('json', schema, undefined, {
    validationFunction: (schema, value) => schema.safeParse(value),
  }),
  (c) => c.json(c.req.valid('json'))
)
```

Compile the final schema once, outside the request handler.
Keep the default parser for asynchronous checks or transforms; `.safeParse()` throws when it encounters a Promise.
Zod may run callbacks twice on invalid input and falls back to runtime parsing when compilation is unavailable or unsupported.
See the compiler documentation for supported schemas and runtime requirements.

Measure your endpoints before choosing this option.
Use `.safeParse()`, not the boolean `.validate()`: the middleware needs parsed output and error details.

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
