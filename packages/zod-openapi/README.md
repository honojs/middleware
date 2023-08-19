# Zod OpenAPI Hono

**Zod OpenAPI Hono** is extending Hono to support OpenAPI.
With it, you can validate values and types using [**Zod**](https://zod.dev/) and generate OpenAPI Swagger documentation.
This is based on [**Zod to OpenAPI**](https://github.com/asteasolutions/zod-to-openapi).
For details on creating schemas and defining routes, please refer to this resource.

_This is not a real middleware but hosted on this monorepo._

## Usage

### Installation

You can install it via the npm. Should be installed with `hono` and `zod`.

```sh
npm i hono zod @hono/zod-openapi
```

### Basic Usage

#### Write your application

First, define schemas with Zod:

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
      example: 123,
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

Next, create routes:

```ts
import { createRoute } from '@hono/zod-openapi'

const route = createRoute({
  method: 'get',
  path: '/users/:id',
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
      description: 'Get the user',
    },
  },
})
```

Finally, create the App:

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

// OpenAPI document will be served on /doc
app.doc('/doc', {
  openapi: '3.0.0',
  info: {
    version: '1.0.0',
    title: 'My API',
  },
})
```

### Handling validation errors

You can handle the validation errors the following ways.

Define the schema:

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

Add the response:

```ts
const route = createRoute({
  method: 'get',
  path: '/users/:id',
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
      description: 'Return Error!',
    },
  },
})
```

Add the hook:

```ts
app.openapi(
  route,
  (c) => {
    const { id } = c.req.valid('param')
    return c.jsonT({
      id: Number(id),
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
          message: 'Validation Error!',
        },
        400
      )
    }
  }
)
```

### Middleware

You can use Hono's middleware as same as using Hono because Zod OpenAPI is just extending Hono.

```ts
import { prettyJSON } from 'hono/pretty-json'

//...

app.use('/doc/*', prettyJSON())
```

### RPC-mode

Zod OpenAPI Hono supports Hono's RPC-mode. You can create the types for passing Hono Client:

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

## References

- [Hono](https://hono.dev/)
- [Zod](https://zod.dev/)
- [Zod to OpenAPI](https://github.com/asteasolutions/zod-to-openapi)

## Authors

- Yusuke Wada <https://github.com/yusukebe>

## License

MIT
