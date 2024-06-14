import type { Env, Hono, ToSchema } from 'hono'
import { assertType, describe, expectTypeOf, it } from 'vitest'
import { OpenAPIHono, createRoute, z } from '../src/index'

describe('Types', () => {
  const RequestSchema = z.object({
    id: z.number().openapi({}),
    title: z.string().openapi({}),
  })

  const PostSchema = z
    .object({
      id: z.number().openapi({}),
      message: z.string().openapi({}),
    })
    .openapi('Post')

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
    const data = c.req.valid('json')
    assertType<number>(data.id)
    return c.json({
      id: data.id,
      message: 'Success',
    })
  })

  it('Should return correct types', () => {
    type H = Hono<
      Env,
      ToSchema<
        'post',
        '/posts',
        {
          json: {
            title: string
            id: number
          }
        },
        {
          id: number
          message: string
        }
      >,
      '/'
    >
    expectTypeOf(appRoutes).toMatchTypeOf<H>()
  })
})

describe('Input types', () => {
  const ParamsSchema = z.object({
    id: z
      .string()
      .transform(Number)
      .openapi({
        param: {
          name: 'id',
          in: 'path',
        },
        example: '123',
      }),
  })

  const QuerySchema = z.object({
    age: z
      .string()
      .transform(Number)
      .openapi({
        param: {
          name: 'age',
          in: 'query',
        },
        example: '42',
      }),
  })

  const BodySchema = z
    .object({
      sex: z.enum(['male', 'female']).openapi({}),
    })
    .openapi('User')

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
      sex: z.enum(['male', 'female']).openapi({
        example: 'male',
      }),
    })
    .openapi('User')

  const route = createRoute({
    method: 'patch',
    path: '/users/{id}',
    request: {
      params: ParamsSchema,
      query: QuerySchema,
      body: {
        content: {
          'application/json': {
            schema: BodySchema,
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: UserSchema,
          },
        },
        description: 'Update a user',
      },
    },
  })

  it('Should return correct types', () => {
    const app = new OpenAPIHono()

    app.openapi(route, (c) => {
      const { id } = c.req.valid('param')
      assertType<number>(id)

      const { age } = c.req.valid('query')
      assertType<number>(age)

      const { sex } = c.req.valid('json')
      assertType<'male' | 'female'>(sex)

      return c.json({
        id,
        age,
        sex,
        name: 'Ultra-man',
      })
    })
  })
})

describe('Response schema includes a Date type', () => {
  it('Should not throw a type error', () => {
    new OpenAPIHono().openapi(
      createRoute({
        method: 'get',
        path: '/example',
        responses: {
          200: {
            content: {
              'application/json': {
                schema: z.object({
                  updatedAt: z.date(),
                }),
              },
            },
            description: '',
          },
        },
      }),
      async (ctx) => {
        // Don't throw an error:
        return ctx.json({ updatedAt: new Date() }, 200)
      }
    )
  })
})
