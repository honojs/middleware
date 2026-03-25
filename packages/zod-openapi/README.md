# Zod OpenAPI Hono

[![codecov](https://codecov.io/github/honojs/middleware/graph/badge.svg?flag=zod-openapi)](https://codecov.io/github/honojs/middleware)

**Zod OpenAPI Hono** is an extended Hono class that supports OpenAPI. With it, you can validate values and types using [**Zod**](https://zod.dev/) and generate OpenAPI Swagger documentation. This is based on [**Zod to OpenAPI**](https://github.com/asteasolutions/zod-to-openapi) (thanks a lot!). For details on creating schemas and defining routes, please refer to [the "Zod to OpenAPI" resource](https://github.com/asteasolutions/zod-to-openapi).

_Note: This is not standalone middleware but is hosted on the monorepo "[github.com/honojs/middleware](https://github.com/honojs/middleware)"._

## Usage

### Installation

You can install it via npm. It should be installed alongside `hono` and `zod`.

```sh
npm i hono zod @hono/zod-openapi
```

### Basic Usage

#### Setting up your application

First, define your schemas with Zod. The `z` object should be imported from `@hono/zod-openapi`:

```ts
import { z } from '@hono/zod-openapi'

const ParamsSchema = z.object({
  id: z
    .string()
    .min(3)
    .openapi({
      param: {
        name: 'id',
        in: 'path',
      },
      example: '1212121',
    }),
})

const UserSchema = z
  .object({
    id: z.string().openapi({
      example: '123',
    }),
    name: z.string().openapi({
      example: 'John Doe',
    }),
    age: z.number().openapi({
      example: 42,
    }),
  })
  .openapi('User')
```

> [!TIP]
>
> `UserSchema` schema will be registered as `"#/components/schemas/User"` refs in the OpenAPI document.
> If you want to register the schema as referenced components, use `.openapi()` method.

Next, create a route:

```ts
import { createRoute } from '@hono/zod-openapi'

const route = createRoute({
  method: 'get',
  path: '/users/{id}',
  request: {
    params: ParamsSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: UserSchema,
        },
      },
      description: 'Retrieve the user',
    },
  },
})
```

Finally, set up the app:

```ts
import { OpenAPIHono } from '@hono/zod-openapi'

const app = new OpenAPIHono()

app.openapi(route, (c) => {
  const { id } = c.req.valid('param')
  return c.json(
    {
      id,
      age: 20,
      name: 'Ultra-man',
    },
    200 // You should specify the status code even if it is 200.
  )
})

// The OpenAPI documentation will be available at /doc
app.doc('/doc', {
  openapi: '3.0.0',
  info: {
    version: '1.0.0',
    title: 'My API',
  },
})
```

You can start your app just like you would with Hono. For Cloudflare Workers and Bun, use this entry point:

```ts
export default app
```

> [!IMPORTANT]
> The request must have the proper `Content-Type` to ensure the validation. For example, if you want to validate a JSON body, the request must have the `Content-Type` to `application/json` in the request. Otherwise, the value of `c.req.valid('json')` will be `{}`.
>
> ```ts
> import { createRoute, z, OpenAPIHono } from '@hono/zod-openapi'
>
> const route = createRoute({
>   method: 'post',
>   path: '/books',
>   request: {
>     body: {
>       content: {
>         'application/json': {
>           schema: z.object({
>             title: z.string(),
>           }),
>         },
>       },
>     },
>   },
>   responses: {
>     200: {
>       description: 'Success message',
>     },
>   },
> })
>
> const app = new OpenAPIHono()
>
> app.openapi(route, (c) => {
>   const validatedBody = c.req.valid('json')
>   return c.json(validatedBody) // validatedBody is {}
> })
>
> const res = await app.request('/books', {
>   method: 'POST',
>   body: JSON.stringify({ title: 'foo' }),
>   // The Content-Type header is lacking.
> })
>
> const data = await res.json()
> console.log(data) // {}
> ```
>
> If you want to force validation of requests that do not have the proper `Content-Type`, set the value of `request.body.required` to `true`.
>
> ```ts
> const route = createRoute({
>   method: 'post',
>   path: '/books',
>   request: {
>     body: {
>       content: {
>         'application/json': {
>           schema: z.object({
>             title: z.string(),
>           }),
>         },
>       },
>       required: true, // <== add
>     },
>   },
> })
> ```

### Handling Validation Errors

Validation errors can be handled as follows:

First, define the error schema:

```ts
const ErrorSchema = z.object({
  code: z.number().openapi({
    example: 400,
  }),
  message: z.string().openapi({
    example: 'Bad Request',
  }),
})
```

Then, add the error response:

```ts
const route = createRoute({
  method: 'get',
  path: '/users/{id}',
  request: {
    params: ParamsSchema,
  },
  responses: {
    400: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'Returns an error',
    },
  },
})
```

Finally, add the hook:

```ts
app.openapi(
  route,
  (c) => {
    const { id } = c.req.valid('param')
    return c.json(
      {
        id,
        age: 20,
        name: 'Ultra-man',
      },
      200
    )
  },
  // Hook
  (result, c) => {
    if (!result.success) {
      return c.json(
        {
          code: 400,
          message: 'Validation Error',
        },
        400
      )
    }
  }
)
```

### A DRY approach to handling validation errors

In the case that you have a common error formatter, you can initialize the `OpenAPIHono` instance with a `defaultHook`.

```ts
const app = new OpenAPIHono({
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json(
        {
          ok: false,
          errors: formatZodErrors(result),
          source: 'custom_error_handler',
        },
        422
      )
    }
  },
})
```

You can still override the `defaultHook` by providing the hook at the call site when appropriate.

```ts
// uses the defaultHook
app.openapi(createPostRoute, (c) => {
  const { title } = c.req.valid('json')
  return c.json({ title })
})

// override the defaultHook by passing in a hook
app.openapi(
  createBookRoute,
  (c) => {
    const { title } = c.req.valid('json')
    return c.json({ title }, 200)
  },
  (result, c) => {
    if (!result.success) {
      return c.json(
        {
          ok: false,
          source: 'routeHook' as const,
        },
        400
      )
    }
  }
)
```

### Response validation (optional)

You can opt in to validating outgoing JSON against the route `responses` schemas. Validation runs when the handler calls `c.json(payload, status)` (or `c.json(payload, { status })`), so the payload is checked **before** a `Response` is built—not by re-reading the body afterward.

Enable flags on `OpenAPIHono`:

- `strictStatusCode` — the status passed to `c.json` must match the route’s `responses` (numeric keys, range keys like `2XX`, or `default`).
- `strictResponse` — when the resolved response entry has an `application/json` schema, the JSON value is validated with that Zod schema. If there is no JSON schema for that status (e.g. `204`), validation is skipped.

When validation fails, `defaultResponseHook` (or the route-level `responseHook`) runs. Return a `Response` from the hook to control the error payload; if you return nothing, a small JSON error with status `500` is sent.

The default body for body-validation failures includes Zod **`issues`**, which can be detailed. For production APIs, use **`defaultResponseHook` / `responseHook`** to return a smaller or redacted error shape.

```ts
const app = new OpenAPIHono({
  strictStatusCode: true,
  strictResponse: true,
  defaultResponseHook: (result, c) => {
    if (result.kind === 'status_mismatch') {
      return c.json({ error: 'Unexpected status', status: result.status }, 500)
    }
    return c.json({ error: 'Invalid response body', issues: result.error.issues }, 500)
  },
})
```

Pass a **hooks object** as the third argument to `app.openapi` when you need both request validation (`hook`) and per-route response errors (`responseHook`):

```ts
app.openapi(route, handler, {
  hook: (result, c) => {
    /* request validation — same as before */
  },
  responseHook: (result, c) => {
    if (result.kind === 'body') {
      return c.json({ message: 'Bad handler output' }, 500)
    }
  },
})
```

#### Scope and limitations

- Only **`c.json(...)`** is validated (together with **`c.status`** when inferring the status). **`c.text`**, **`c.html`**, **`c.body`**, and **`return new Response(...)`** are not checked.
- If one response defines **several** JSON-compatible media types under `content`, the **first** such entry (object key order) is used for `strictResponse`.
- Wrapping runs for the **OpenAPI route handler** (after built-in validators). If **route `middleware` returns a response without calling `next()`**, that response bypasses strict checks. Likewise, calling **`c.json` only after the handler has returned** does not go through validation.
- With `strictStatusCode` or `strictResponse` enabled, the handler is executed inside an **async** wrapper (usually negligible; it can show up in stack traces).
- Status range keys must follow **OpenAPI spelling** (`1XX` … `5XX` with uppercase `X`); other strings are not treated as ranges.

### OpenAPI v3.1

You can generate OpenAPI v3.1 spec using the following methods:

```ts
app.doc31('/docs', { openapi: '3.1.0', info: { title: 'foo', version: '1' } }) // new endpoint
app.getOpenAPI31Document(
  {
    openapi: '3.1.0',
    info: { title: 'foo', version: '1' },
  }, // OpenAPI object config
  {
    unionPreferredType: 'oneOf',
  } // Generator options
) // schema object
```

The second parameter is optional and accepts generator options as supported by the `@asteasolutions/zod-to-openapi` library. Refer to their documentation for the complete list of available options and their usage.

### The Registry

You can access the [`OpenAPIRegistry`](https://github.com/asteasolutions/zod-to-openapi#the-registry) object via `app.openAPIRegistry`:

```ts
const registry = app.openAPIRegistry
```

### Middleware

Zod OpenAPI Hono is an extension of Hono, so you can use Hono's middleware in the same way:

```ts
import { prettyJSON } from 'hono/pretty-json'

//...

app.use('/doc/*', prettyJSON())
```

### Configure middleware for each endpoint

You can configure middleware for each endpoint from a route created by `createRoute` as follows.

```ts
import { prettyJSON } from 'hono/pretty-json'
import { cache } from 'hono/cache'

app.use(route.getRoutingPath(), prettyJSON(), cache({ cacheName: 'my-cache' }))
app.openapi(route, handler)
```

Or you can use the `middleware` property in the route definition.

```ts
const route = createRoute({
  method: 'get',
  path: '/users/{id}',
  request: {
    params: ParamsSchema,
  },
  middleware: [prettyJSON(), cache({ cacheName: 'my-cache' })] as const, // Use `as const` to ensure TypeScript infers the middleware's Context.
  responses: {
    200: {
      content: {
        'application/json': {
          schema: UserSchema,
        },
      },
      description: 'Retrieve the user',
    },
  },
})
```

### RPC Mode

Zod OpenAPI Hono supports Hono's RPC mode. You can define types for the Hono Client as follows:

```ts
import { hc } from 'hono/client'

const appRoutes = app.openapi(route, (c) => {
  const data = c.req.valid('json')
  return c.json(
    {
      id: data.id,
      message: 'Success',
    },
    200
  )
})

const client = hc<typeof appRoutes>('http://localhost:8787/')
```

## Tips

### Type utilities

Methods like `get()`, `post()`, `use()`, etc. return `Hono` type instead of `OpenAPIHono`. This can cause issues when you need the `OpenAPIHono` type. Use the `$()` function to convert the instance back to `OpenAPIHono` type:

```ts
import { OpenAPIHono, $ } from '@hono/zod-openapi'

const app = $(new OpenAPIHono().use(middleware))
app.openapi(route, handler)
```

You can also use the `HonoToOpenAPIHono` utility type to convert the return type at the type level:

```ts
import type { HonoToOpenAPIHono } from '@hono/zod-openapi'

const app = new OpenAPIHono()
const result = app.get('/hello', (c) => c.json({ message: 'Hello' }))

// `result` is Hono type, convert it to OpenAPIHono
type MyApp = HonoToOpenAPIHono<typeof result>
```

### How to register components

You can register components to the registry as follows:

```ts
app.openAPIRegistry.registerComponent('schemas', {
  User: UserSchema,
})
```

About this feature, please refer to [the "Zod to OpenAPI" resource / Defining Custom Components](https://github.com/asteasolutions/zod-to-openapi#defining-custom-components)

### How to setup authorization

You can setup authorization as follows:

eg. Bearer Auth

Register the security scheme:

```ts
app.openAPIRegistry.registerComponent('securitySchemes', 'Bearer', {
  type: 'http',
  scheme: 'bearer',
})
```

And setup the security scheme for specific routes:

```ts
const route = createRoute({
  // ...
  security: [
    {
      Bearer: [],
    },
  ],
})
```

### How to access context in app.doc

You can access the context in `app.doc` as follows:

```ts
app.doc('/doc', (c) => ({
  openapi: '3.0.0',
  info: {
    version: '1.0.0',
    title: 'My API',
  },
  servers: [
    {
      url: new URL(c.req.url).origin,
      description: 'Current environment',
    },
  ],
}))
```

### How to exclude a specific route from OpenAPI docs

You can use `hide` property as follows:

```ts
const route = createRoute({
  // ...
  hide: true,
})
```

## Limitations

### Combining with `Hono`

Be careful when combining `OpenAPIHono` instances with plain `Hono` instances. `OpenAPIHono` will merge the definitions of direct subapps, but plain `Hono` knows nothing about the OpenAPI spec additions. Similarly `OpenAPIHono` will not "dig" for instances deep inside a branch of plain `Hono` instances.

If you're migrating from plain `Hono` to `OpenAPIHono`, we recommend porting your top-level app, then working your way down the router tree.

When using the `.route()` method to mount a child OpenAPIHono app that uses path parameters, you should use the Hono _:param_ syntax in the parent route path, rather than the OpenAPI _{param}_ syntax:

```
const bookActionsApp = new OpenAPIHono()
...
// ❌ Incorrect: This will not match the route
app.route('/books/{bookId}', bookActionsApp)

// ✅ Using Hono parameter syntax
app.route('/books/:bookId', bookActionsApp)
```

### Header keys

Header keys that you define in your schema must be in lowercase.

```ts
const HeadersSchema = z.object({
  // Header keys must be in lowercase, `Authorization` is not allowed.
  authorization: z.string().openapi({
    example: 'Bearer SECRET',
  }),
})
```

## References

- [Hono](https://hono.dev/)
- [Zod](https://zod.dev/)
- [Zod to OpenAPI](https://github.com/asteasolutions/zod-to-openapi)

## Authors

- Yusuke Wada <https://github.com/yusukebe>

## License

MIT
