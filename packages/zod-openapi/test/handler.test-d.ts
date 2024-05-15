import { OpenAPIHono, createRoute, z } from '../src'

test('supports async handler', () => {
  const hono = new OpenAPIHono()

  const route = createRoute({
    method: 'get',
    path: '/users',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              id: z.string(),
            }),
          },
        },
        description: 'Retrieve the user',
      },
    },
  })

  hono.openapi(route, (c) => {
    return c.json({
      id: '123',
    })
  })

  hono.openapi(route, async (c) => {
    return c.json({
      id: '123',
    })
  })
})
