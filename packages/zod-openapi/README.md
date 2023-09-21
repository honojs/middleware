# Zod OpenAPI Hono

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
  return c.jsonT({
    id,
    age: 20,
    name: 'Ultra-man',
  })
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
    return c.jsonT({
      id,
      age: 20,
      name: 'Ultra-man',
    })
  },
  // Hook
  (result, c) => {
    if (!result.success) {
      return c.jsonT(
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
      return c.jsonT(
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
  return c.jsonT({ title })
})

// override the defaultHook by passing in a hook
app.openapi(
  createBookRoute,
  (c) => {
    const { title } = c.req.valid('json')
    return c.jsonT({ title })
  },
  (result, c) => {
    if (!result.success) {
      return c.jsonT(
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

### OpenAPI v3.1

You can generate OpenAPI v3.1 spec using the following methods:

```ts
app.doc31('/docs', {openapi: '3.1.0'}) // new endpoint
app.getOpenAPI31Document(, {openapi: '3.1.0'}) // raw json
```

### The Registry

You can access the [`OpenAPIRegistry`](https://github.com/asteasolutions/zod-to-openapi#the-registry) object via `app.openAPIRegistry`:

```ts
const registry = app.openAPIRegistry
```

### SwaggerUI

The `swagger` method can be used to host swagger ui.

```ts
const config = {
  openapi: '3.0.0',
  info: {
    version: '1.0.0',
    title: 'My API',
  },
}
app.swagger('/swagger-ui', config)
```

The `SwaggerUI` component allows you to embed the Swagger UI interface in your application for API documentation and testing. Simply specify the URL of your OpenAPI specification using the `openapi` prop.

Here's a quick example:

```tsx
const config = {
  openapi: '3.0.0',
  info: {
    version: '1.0.0',
    title: 'My API',
  },
}
app.doc('/doc', config)

app.get('/swagger-ui', async (c) => {
  return c.html(<SwaggerUI url='/doc' />)
})
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
import { cache } from 'honoc/cache'

app.use(route.getRoutingPath(), prettyJSON(), cache({ cacheName: 'my-cache' }))
app.openapi(route, handler)
```

### RPC Mode

Zod OpenAPI Hono supports Hono's RPC mode. You can define types for the Hono Client as follows:

```ts
import { hc } from 'hono/client'

const appRoutes = app.openapi(route, (c) => {
  const data = c.req.valid('json')
  return c.jsonT({
    id: data.id,
    message: 'Success',
  })
})

const client = hc<typeof appRoutes>('http://localhost:8787/')
```

## Limitations

Be careful when combining `OpenAPIHono` instances with plain `Hono` instances. `OpenAPIHono` will merge the definitions of direct subapps, but plain `Hono` knows nothing about the OpenAPI spec additions. Similarly `OpenAPIHono` will not "dig" for instances deep inside a branch of plain `Hono` instances.

If you're migrating from plain `Hono` to `OpenAPIHono`, we recommend porting your top-level app, then working your way down the router tree.

## References

- [Hono](https://hono.dev/)
- [Zod](https://zod.dev/)
- [Zod to OpenAPI](https://github.com/asteasolutions/zod-to-openapi)

## Authors

- Yusuke Wada <https://github.com/yusukebe>

## License

MIT
