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

import { createRoute } from '../src'

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

import { OpenAPIHono } from '../src'

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

// The OpenAPI documentation will be available at /openapi.json
app.doc('/openapi.json', {
  documentation: {
    openapi: '3.1.0',
    info: {
      version: '1.0.0',
      title: 'My API',
    },
  },
})

export default {
  fetch: app.fetch,
  port: 8080,
}
