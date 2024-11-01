# Typebox OpenAPI Hono

**Typebox OpenAPI Hono** is an extended Hono class that supports OpenAPI. With it, you can validate values and types using [**Typebox**](https://github.com/sinclairzx81/typebox) and generate OpenAPI 3.1 documentation.

## Usage

### Installation

You can install it via npm. It should be installed alongside `hono` and `zod`.

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

## Author

Eliott Wantz <https://github.com/eliottwantz>

## License

MIT
