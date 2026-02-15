import { hc } from 'hono/client'
import { testClient } from 'hono/testing'
import { z } from 'zod'
import { OpenAPIHono, createRoute, defineOpenAPIRoute } from '.'

const getRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get',
    path: '/items/{itemId}',
    request: {
      params: z
        .object({
          itemId: z.uuid(),
        })
        .openapi({
          description: 'The ID of the item',
          param: {
            in: 'path',
            name: 'itemId',
          },
        }),
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              protected: z.boolean(),
            }),
          },
        },
        description: 'Item resource',
      },
    },
  }),
  handler: (c) => {
    return c.json({ protected: true }, 200)
  },
})

const postRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post',
    path: '/itemz',
    // hide: true, // Example of hiding a route from OpenAPI docs and disabling it in rpc client when using openapiRoutes
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({
              name: z.string(),
              value: z.number(),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
            }),
          },
        },
        description: 'Data processed',
      },
    },
  }),
  handler: (c) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const body = c.req.valid('json')
    return c.json({ success: true }, 200)
  },
  addRoute: false,
})

const routes = [getRoute, postRoute] as const

// Conditionally build the routes array
const app = new OpenAPIHono().openapiRoutes(routes)

const client = hc<typeof app>('/')

export async function prodTest(): Promise<{ protected: boolean }> {
  const getResponse = await client.items[':itemId'].$get({
    param: { itemId: '550e8400-e29b-41d4-a716-446655440000' },
  })
  await client.itemz.$post({
    json: { name: 'example', value: 42 },
  })
  console.log(await getResponse.json())
  return await getResponse.json() // boolean
}
