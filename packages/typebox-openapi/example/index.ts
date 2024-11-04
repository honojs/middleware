import { Kind, Type as T, TSchema, TypeRegistry } from '@sinclair/typebox'
import { OpenAPIHono, createRoute } from '../src'

const RequestSchema = T.Object({
  id: T.Number(),
  title: T.String(),
})

const PostSchema = T.Object(
  {
    id: T.Number(),
    title: T.String(),
  },
  { $id: 'Post' }
)

const route = createRoute({
  method: 'post',
  path: '/posts',
  request: {
    body: {
      content: {
        'application/json': {
          schema: RequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: PostSchema,
        },
      },
      description: 'Post a post',
    },
  },
})

const app = new OpenAPIHono()

const appRoutes = app.openapi(route, (c) => {
  const { id, title } = c.req.valid('json')
  return c.json({
    id,
    title,
  })
})

export type AppType = typeof appRoutes

TypeRegistry.Set('Form', (schema, value) => {
  console.log('Form called')
  return true
})

// export default {
//   fetch: app.fetch,
//   port: 8080,
// }
Deno.serve({
  port: 8080,
  handler: app.fetch,
})
