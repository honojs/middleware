# ata validator middleware for Hono

[![codecov](https://codecov.io/github/honojs/middleware/graph/badge.svg?flag=ata-validator)](https://codecov.io/github/honojs/middleware)

Validator middleware using [ata-validator](https://github.com/ata-core/ata-validator) for [Hono](https://honojs.dev) applications. The schema is plain JSON Schema; written as a literal it also types the validated data, so `c.req.valid()` returns the shape the schema describes. Where dynamic code is refused, on Cloudflare Workers or under a strict Content-Security-Policy, the validator runs its interpreted engine and the middleware works unchanged.

## Usage

No Hook:

```ts
import { ataValidator } from '@hono/ata-validator'

const schema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    age: { type: 'number' },
  },
  required: ['name', 'age'],
  additionalProperties: false,
} as const

const route = app.post('/user', ataValidator('json', schema), (c) => {
  const user = c.req.valid('json')
  return c.json({ success: true, message: `${user.name} is ${user.age}` })
})
```

When validation fails and no hook returns a response, the middleware answers `400` with `{ success: false, errors }`, where each error carries `keyword`, `instancePath`, `schemaPath`, `params` and `message`. A prepared `Validator` (below) reports its own error shape, which is the richer one by default, with `code`, `expected`, `received` and a `docUrl`.

Hook:

```ts
import { ataValidator } from '@hono/ata-validator'

app.post(
  '/user',
  ataValidator('json', schema, (result, c) => {
    if (!result.success) {
      return c.text('Invalid!', 400)
    }
  })
  //...
)
```

A prepared validator, for options such as type coercion on a query string, defaults, or the rich error shape:

```ts
import { Validator } from 'ata-validator'
import { ataValidator } from '@hono/ata-validator'

const page = new Validator(
  {
    type: 'object',
    properties: { page: { type: 'integer', minimum: 1, default: 1 } },
  } as const,
  { coerceTypes: true, useDefaults: true }
)

app.get('/posts', ataValidator('query', page), (c) => {
  const { page } = c.req.valid('query') // a number, 1 when absent
  //...
})
```

## Author

Mert Can Altin <https://github.com/mertcanaltin>

## License

MIT
