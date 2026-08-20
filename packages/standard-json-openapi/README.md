# Standard JSON OpenAPI Hono

[![codecov](https://codecov.io/github/honojs/middleware/graph/badge.svg?flag=standard-json-openapi)](https://codecov.io/github/honojs/middleware)

**Standard JSON OpenAPI Hono** is an extended Hono class that validates requests and generates OpenAPI documentation from any schema library implementing [Standard JSON Schema](https://standardschema.dev/json-schema). Schemas describe themselves, so no library is built in and a single route can mix several.

If every schema you write is Zod and you want Zod's own OpenAPI metadata API, [`@hono/zod-openapi`](../zod-openapi) is the better fit. Use this package when you want your schema library to be an implementation detail.

_Note: This is not standalone middleware but is hosted on the monorepo "[github.com/honojs/middleware](https://github.com/honojs/middleware)"._

## Usage

### Installation

You can install it via npm. It should be installed alongside `hono`.

```sh
npm i hono @hono/standard-json-openapi
```

Your schema library is the only other dependency, and it is yours to choose.

### Supported schema libraries

Any validation library listed on the [Standard JSON Schema spec page](https://standardschema.dev/json-schema) is supported here.

Some libraries (notably Valibot and Zod Mini) do **not** expose the `~standard.jsonSchema` interface by default for bundle size reasons. You'll need to follow their instructions on how to expose the interface (in the case of Valibot, this requires you to wrap your schema with the `toStandardJsonSchema` function from `@valibot/to-json-schema`, in Zod Mini's case, you build the interface yourself from `z.toJSONSchema`).

A schema that reaches a route without `~standard.jsonSchema` is treated as a literal JSON Schema object and is neither converted nor validated, so wrap before you use it.

Every example below writes the same object — `{ name: string }` — so you can read whichever lines match your library and ignore the rest:

```ts
// Zod 4 — the interface is built in.
import { z } from 'zod'
const User = z.object({ name: z.string() })

// ArkType — the interface is built in.
import { type } from 'arktype'
const User = type({ name: 'string' })

// Valibot — wrap once with `toStandardJsonSchema()`.
import * as v from 'valibot'
import { toStandardJsonSchema } from '@valibot/to-json-schema'
const User = toStandardJsonSchema(v.object({ name: v.string() }))
```

Zod Mini ships no wrapper that hands a schema back, so hang the interface off it yourself with `z.toJSONSchema`. Passing the result of `z.toJSONSchema()` straight into a route documents the schema but cannot validate it, because the plain JSON Schema object it returns has no `~standard.validate`:

```ts
import * as z from 'zod/mini'

const withJSONSchema = <T extends z.core.$ZodType>(schema: T) =>
  Object.assign(schema, {
    '~standard': {
      ...schema['~standard'],
      jsonSchema: {
        input: (options?: { target?: string }) =>
          z.toJSONSchema(schema, { io: 'input', target: options?.target as never }),
        output: (options?: { target?: string }) =>
          z.toJSONSchema(schema, { io: 'output', target: options?.target as never }),
      },
    },
  })

const User = withJSONSchema(z.object({ name: z.string() }))
```

### Basic Usage

Define a route with `createRoute()`, register it with `app.openapi()`, and serve the document. Only the schema lines differ between libraries:

```ts
import { z } from 'zod'
import { OpenAPIHono, createRoute } from '@hono/standard-json-openapi'

const route = createRoute({
  method: 'post',
  path: '/users',
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: z.object({ name: z.string() }) } },
    },
  },
  responses: {
    200: {
      description: 'Created',
      content: { 'application/json': { schema: z.object({ id: z.string() }) } },
    },
  },
})

const app = new OpenAPIHono()

app.openapi(route, (c) => {
  const { name } = c.req.valid('json')
  return c.json({ id: name }, 200)
})

app.doc31('/doc', {
  openapi: '3.1.0',
  info: { version: '1.0.0', title: 'My API' },
})
```

The same route with Valibot:

```ts
import * as v from 'valibot'
import { toStandardJsonSchema } from '@valibot/to-json-schema'
import { OpenAPIHono, createRoute } from '@hono/standard-json-openapi'

const route = createRoute({
  method: 'post',
  path: '/users',
  request: {
    body: {
      required: true,
      content: {
        'application/json': { schema: toStandardJsonSchema(v.object({ name: v.string() })) },
      },
    },
  },
  responses: {
    200: {
      description: 'Created',
      content: {
        'application/json': { schema: toStandardJsonSchema(v.object({ id: v.string() })) },
      },
    },
  },
})
```

And with ArkType:

```ts
import { type } from 'arktype'
import { OpenAPIHono, createRoute } from '@hono/standard-json-openapi'

const route = createRoute({
  method: 'post',
  path: '/users',
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: type({ name: 'string' }) } },
    },
  },
  responses: {
    200: {
      description: 'Created',
      content: { 'application/json': { schema: type({ id: 'string' }) } },
    },
  },
})
```

Requests are validated against the same schema that documents them, and `c.req.valid()` is typed from it.

### Mixing libraries

Schemas are read through one interface, so a single route can take them from anywhere:

```ts
import { type } from 'arktype'
import * as v from 'valibot'
import { toStandardJsonSchema } from '@valibot/to-json-schema'
import { z } from 'zod'
import { OpenAPIHono, createRoute } from '@hono/standard-json-openapi'

const route = createRoute({
  method: 'post',
  path: '/users/{id}',
  request: {
    // Valibot
    params: toStandardJsonSchema(v.object({ id: v.string() })),
    // Zod
    query: z.object({ tag: z.string() }),
    body: {
      required: true,
      // ArkType
      content: { 'application/json': { schema: type({ name: 'string' }) } },
    },
  },
  responses: {
    200: {
      description: 'Created',
      content: { 'application/json': { schema: z.object({ id: z.string() }) } },
    },
  },
})
```

### Input and output types

Request bodies and parameters are described by the schema's **input** type; responses by its **output** type. A field with a default is therefore optional in the request and guaranteed in the response.

### Reusable components

Name a schema to have every use of it become a `$ref` into `components.schemas`. Any library works — the registry never looks at where the schema came from:

```ts
const app = new OpenAPIHono()

// Zod
const User = app.openAPIRegistry.register('User', z.object({ id: z.string() }))
// Valibot
const Post = app.openAPIRegistry.register(
  'Post',
  toStandardJsonSchema(v.object({ id: v.string() }))
)
// ArkType
const Tag = app.openAPIRegistry.register('Tag', type({ id: 'string' }))
```

When a schema's input and output differ, two components are emitted — `User` for responses and `UserInput` for requests — and each side refs the right one.

Hand-written components work the same way and return a ref you can use directly:

```ts
const { ref } = app.openAPIRegistry.registerComponent('securitySchemes', 'bearer', {
  type: 'http',
  scheme: 'bearer',
})
```

### JSON Schema dialects

Libraries support different JSON Schema dialects. By default OpenAPI 3.0 asks for `openapi-3.0` and falls back to `draft-07`; OpenAPI 3.1 asks for `draft-2020-12`. Zod and Valibot accept `openapi-3.0` directly, so the default needs no help; ArkType implements the drafts only and takes the fallback. Set the dialect yourself when you know what your library emits:

```ts
const app = new OpenAPIHono({
  // ArkType implements the drafts only — ask for draft-07 and skip the fallback.
  jsonSchemaTargets: { '3.0': ['draft-07'] },
})

// Or for a single document:
app.getOpenAPIDocument(config, { jsonSchemaTargets: ['draft-07'] })
```

If no listed dialect is accepted, generation throws and names the library that refused.

### OpenAPI docs

```ts
app.doc('/doc', {
  openapi: '3.0.0',
  info: { version: '1.0.0', title: 'My API' },
})

app.doc31('/doc31', {
  openapi: '3.1.0',
  info: { version: '1.0.0', title: 'My API' },
})
```

`getOpenAPIDocument()` and `getOpenAPI31Document()` return the same documents without serving them.

### Validation hooks

A hook receives the result of validation. Failures arrive as Standard Schema issues, whichever library produced them:

```ts
const app = new OpenAPIHono({
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json({ ok: false, errors: result.error }, 400)
    }
  },
})
```

A hook passed as the third argument to `app.openapi()` takes precedence over `defaultHook`.

## Limitations

- **An array of request header schemas is not typed.** `request.headers` accepts several schemas, and every one of them is documented and validated. Hono keeps a single `header` validation target, though, so `c.req.valid('header')` is typed only when you pass one schema; with an array, read the headers off `c.req.header()`.
- **OpenAPI 3.0 documents depend on the dialect your library emits.** A library that only implements the JSON Schema drafts falls back to `draft-07`, and constructs that OpenAPI 3.0 lacks pass through unconverted. Use `jsonSchemaTargets` to choose deliberately, or prefer `doc31()`, which needs no fallback.

## References

- [Hono](https://hono.dev/)
- [Standard JSON Schema](https://standardschema.dev/json-schema)
- [@hono/zod-openapi](../zod-openapi)
- [@hono/standard-validator](../standard-validator)

## Authors

- Gustavo Santos Thiago <https://github.com/gusanthiago>

## License

MIT
