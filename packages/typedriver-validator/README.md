# TypeDriver validator middleware for Hono

[![codecov](https://codecov.io/github/honojs/middleware/graph/badge.svg?typedriver-validator)](https://codecov.io/github/honojs/middleware)

Validator middleware using [TypeDriver](https://github.com/sinclairzx81/typedriver) for [Hono](https://honojs.dev) applications.
Enables unified integration for TypeScript, JSON Schema and Standard Schema.

## Options

The following error reporting options are available for this validator. The defaults are `json-schema` and `en_US`.

```typescript
tdValidator(
  'json',
  `{
  x: number,
  y: number,
  z: number
}`,
  {
    format: 'json-schema', // ... or 'standard-schema'
    locale: 'ja_JP', // ... BCP 47 language tag (use underscore)
  }
)
```

## TypeScript DSL

This validator supports library-free schema definitions using TypeScript DSL

```ts
import { tdValidator } from '@hono/typedriver-validator'

const route = app.post(
  '/user',
  tdValidator(
    'json',
    `{
  name: string
  age: number
}`
  ),
  (c) => {
    const user = c.req.valid('json')
    return c.json({ success: true, message: `${user.name} is ${user.age}` })
  }
)
```

With Hook:

```ts
import { tdValidator } from '@hono/typedriver-validator'
import Type from 'typebox'

app.post(
  '/user',
  tdValidator(
    'json',
    `{ 
  name: string, 
  age: number 
}`,
    (result, c) => {
      if (!result.success) {
        return c.text('Invalid!', 400)
      }
    }
  )
  //...
)
```

## JSON Schema

JSON Schema validation and inference is supported.

```typescript
import { tdValidator } from '@hono/typedriver-validator'

const route = app.post(
  '/user',
  tdValidator('json', {
    type: 'object',
    required: ['name', 'age'],
    properties: {
      name: { type: 'string' },
      age: { type: 'number' },
    },
  }),
  (c) => {
    const user = c.req.valid('json')
    return c.json({ success: true, message: `${user.name} is ${user.age}` })
  }
)
```

## Standard Schema

Standard Schema validation and inference is supported.

```typescript
import { tdValidator } from '@hono/typedriver-validator'
import * as z from 'zod'

const route = app.post(
  '/user',
  tdValidator(
    'json',
    z.object({
      name: z.string(),
      age: z.number(),
    })
  ),
  (c) => {
    const user = c.req.valid('json')
    return c.json({ success: true, message: `${user.name} is ${user.age}` })
  }
)
```

## License

MIT
