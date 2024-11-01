import { Type as T } from '@sinclair/typebox'
import { logger } from 'hono/logger'
import { createRoute, OpenAPIHono } from '../src'

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

const ErrorSchema = T.Object({
  code: T.Number({ examples: [400] }),
  message: T.String({ examples: ['Bad Request'] }),
})

const route = createRoute({
  method: 'get',
  path: '/users/{id}',
  request: {
    params: ParamsSchema,
  },
  middleware: [logger()],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: UserSchema,
        },
      },
      description: 'Retrieve the user',
    },
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

const app = new OpenAPIHono({
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json(
        {
          ok: false,
          errors: result.errors,
          source: 'custom_error_handler',
        },
        422
      )
    }
  },
})

// The OpenAPI documentation will be available at /openapi.json
app.doc('/openapi.json', {
  documentation: {
    openapi: '3.1.0',
    info: {
      version: '1.0.0',
      title: 'My API',
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
      },
    },
  },
})

const appRoutes = app.openapi(route, (c) => {
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

export type AppType = typeof appRoutes

export default {
  fetch: app.fetch,
  port: 8080,
}
