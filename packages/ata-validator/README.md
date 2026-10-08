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

## Compiled ahead of time

`ata build` turns a schema into a JavaScript module that imports nothing. The `compiled` entry takes such a module, and imports nothing itself, so the validator engine stays out of the bundle: a Hono app with one validated route is about 2 KB gzipped over the same app with no validation, and it starts as fast. The `.d.ts` that `ata build` writes next to the module types `c.req.valid()`.

```sh
npx ata build 'schemas/*.schema.json' --out-dir src/generated
```

```ts
import { ataCompiled } from '@hono/ata-validator/compiled'
import * as user from './generated/user.schema.js'

app.post('/user', ataCompiled('json', user), (c) => {
  const data = c.req.valid('json')
  return c.json({ success: true, message: `${data.name} is ${data.age}` })
})
```

The hook and the `400` body are the same as above. The module reports every error with `keyword`, `instancePath`, `schemaPath`, `params` and `message`.

## Author

Mert Can Altin <https://github.com/mertcanaltin>

## License

MIT
