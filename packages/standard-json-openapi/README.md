# Standard JSON OpenAPI Hono

`@hono/zod-openapi` takes Zod and nothing else. This package takes schemas from any library implementing [Standard JSON Schema](https://standardschema.dev/json-schema) — ArkType, Valibot once wrapped with `toStandardJsonSchema()`, and Zod 4, which ships it natively. A route can mix them.

If you only use Zod, prefer [`@hono/zod-openapi`](../zod-openapi). Use this one when you want library-agnostic schemas.

_Note: This is not standalone middleware but is hosted on the monorepo "[github.com/honojs/middleware](https://github.com/honojs/middleware)"._

## Installation

```sh
npm i hono zod @hono/standard-json-openapi
```

`zod` is still required: OpenAPI documents go through `@asteasolutions/zod-to-openapi`. Non-Zod schemas are hidden inside a Zod carrier, so your route schemas can still be ArkType, Valibot, etc.

## Usage

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

### How it works

`@asteasolutions/zod-to-openapi` reads Zod internals, so a foreign schema cannot go to it directly. Non-Zod schemas are hidden inside a Zod carrier (`z.string().openapi(jsonSchema)`) — the generator merges `.openapi()` metadata over whatever it generated, so the output comes entirely from `~standard.jsonSchema`. Zod schemas are never converted and behave exactly as before.

### Mixing with Zod

Import `z` from this package when you need Zod's `.openapi()` metadata or registered components:

```ts
import { type } from 'arktype'
import { OpenAPIHono, createRoute, z } from '@hono/standard-json-openapi'

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
      content: {
        'application/json': {
          schema: z.object({ id: z.string() }).openapi('User'),
        },
      },
    },
  },
})
```

Valibot does not implement the interface directly — wrap its schemas with [`toStandardJsonSchema()`](https://valibot.dev/api/toStandardJsonSchema/) from `@valibot/to-json-schema` first.

Request bodies and parameters use the schema's **input** type; responses use its **output** type. So a field with a default is optional in the request and guaranteed in the response.

### JSON Schema targets

Libraries may only support certain JSON Schema dialects. By default OpenAPI 3.0 tries `openapi-3.0` then falls back to `draft-07`, and OpenAPI 3.1 asks for `draft-2020-12`. Override when you know what your validators support:

```ts
const app = new OpenAPIHono({
  // ArkType rejects openapi-3.0 — ask for draft-07 directly.
  jsonSchemaTargets: { '3.0': ['draft-07'] },
})

// Or per document:
app.getOpenAPIDocument(config, undefined, { jsonSchemaTargets: ['draft-07'] })
```

### OpenAPI docs

```ts
app.doc('/doc', {
  openapi: '3.0.0',
  info: { version: '1.0.0', title: 'My API' },
})

app.doc31('/doc', {
  openapi: '3.1.0',
  info: { version: '1.0.0', title: 'My API' },
})
```

## Limitations

- **Zod is still a peer dependency.** Document generation uses `@asteasolutions/zod-to-openapi` under the hood; non-Zod schemas are embedded as Zod carrier metadata.
- **`app.doc()` and OpenAPI 3.0.** ArkType implements only the JSON Schema drafts, so those schemas fall back to `draft-07` and constructs 3.0 lacks pass through unconverted. Prefer `jsonSchemaTargets` when you want to pick the dialect yourself. `app.doc31()` needs no fallback.
- **Validation hooks.** `result.error` is an array of Standard Schema issues for non-Zod schemas, while `Hook` still calls it a `ZodError`. Widening it would break every hook reading `.issues`, so it stays as-is for now.

## References

- [Hono](https://hono.dev/)
- [Standard JSON Schema](https://standardschema.dev/json-schema)
- [Zod to OpenAPI](https://github.com/asteasolutions/zod-to-openapi)
- [@hono/zod-openapi](../zod-openapi)
- [@hono/standard-validator](../standard-validator)

## Authors

- Gustavo Santos Thiago <https://github.com/gusanthiago>

## License

MIT
