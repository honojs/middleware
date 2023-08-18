# Zod OpenAPI Hono

A wrapper class for Hono that supports OpenAPI. With it, you can validate values and types using [Zod](https://zod.dev/) and generate OpenAPI Swagger documentation.
This is based on [Zod to OpenAPI](https://github.com/asteasolutions/zod-to-openapi).
For details on creating schemas and defining routes, please refer to this resource.

_This is not a middleware but hosted on this monorepo_

## Usage

### Install

```
npm i hono zod @hono/zod-openapi
```

### Write your application

Define schemas:

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
    id: z.number().openapi({
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

Create routes:

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
    400: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'Error!',
    },
  },
})
```

Create the App:

```ts
const app = new OpenAPIHono()

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
  (result, c) => {
    if (!result.success) {
      const res = c.jsonT(
        {
          ok: false,
        },
        400
      )
      return res
    }
  }
)

app.doc('/doc', {
  openapi: '3.0.0',
  info: {
    version: '1.0.0',
    title: 'My API',
  },
})
```

## Author

Yusuke Wada <https://github.com/yusukebe>

## License

MIT
