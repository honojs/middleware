# Typebox OpenAPI Hono

**Typebox OpenAPI Hono** is an extended Hono class that supports OpenAPI. With it, you can validate values and types using [**Typebox**](https://github.com/sinclairzx81/typebox) and generate OpenAPI 3.1 documentation.

## Usage

### Installation

You can install it via npm. It should be installed alongside `hono` and `typebox`.

```sh
npm i hono @sinclair/typebox @hono/typebox-openapi
```

### Basic Usage

#### Setting up your application

First, define your schemas with Typebox:

```ts
import { Type as T } from '@sinclair/typebox'

const ParamsSchema = T.Object({
  id: T.String({ minLength: 3, examples: ['1212121'] }),
})

const UserSchema = T.Object(
  {
    id: T.String({ examples: ['123'] }),
    name: T.String({ examples: ['John Doe'] }),
    age: T.Number({ examples: [42] }),
  },
  { $id: 'User' }
)
```

> [!TIP] > `UserSchema` schema will be registered as `"#/components/schemas/User"` refs in the OpenAPI document.
> If you want to register the schema as referenced components, use the `$id` property.

Next, create a route:

```ts
import { createRoute } from '@hono/typebox-openapi'

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
import { OpenAPIHono } from '@hono/typebox-openapi'

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
  documentation: {
    openapi: '3.1.0',
    info: {
      version: '1.0.0',
      title: 'My API',
    },
  },
})
```

You can start your app just like you would with Hono. For Cloudflare Workers and Bun, use this entry point:

```ts
export default app
```

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
          errors: formatTypeboxError(result),
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

### Middleware

Typebox OpenAPI Hono is an extension of Hono, so you can use Hono's middleware in the same way:

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
  middleware: [prettyJSON(), cache({ cacheName: 'my-cache' })],
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

Typebox OpenAPI Hono supports Hono's RPC mode. You can define types for the Hono Client as follows:

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

### How to setup authorization

You can setup authorization as follows:

eg. Bearer Auth

Register the security scheme:

```ts
app.doc('/openapi.json', {
  documentation: {
    openapi: '3.1.0',
    info: {
      version: '1.0.0',
      title: 'My API',
    },
    security: [
      {
        Bearer: [],
      },
    ],
    securitySchemes: {
      Bearer: {
        type: 'http',
        scheme: 'bearer',
      },
    },
  },
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

## Limitations

### Combining with `Hono`

Be careful when combining `OpenAPIHono` instances with plain `Hono` instances. `OpenAPIHono` will merge the definitions of direct subapps, but plain `Hono` knows nothing about the OpenAPI spec additions. Similarly `OpenAPIHono` will not "dig" for instances deep inside a branch of plain `Hono` instances.

If you're migrating from plain `Hono` to `OpenAPIHono`, we recommend porting your top-level app, then working your way down the router tree.

### Header keys

Header keys that you define in your schema must be in lowercase.

```ts
const HeadersSchema = T.Object({
  // Header keys must be in lowercase, `Authorization` is not allowed.
  authorization: T.String({
    examples: ['Bearer SECRET'],
  }),
})
```

## References

- [Hono](https://hono.dev/)
- [Typebox](https://github.com/sinclairzx81/typebox)

## Author

Eliott Wantz <https://github.com/eliottwantz>

## License

MIT
