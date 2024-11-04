import type { Env, Hono, ToSchema } from 'hono'
import { assertType, describe, expectTypeOf, it } from 'vitest'
import { OpenAPIHono, createRoute } from '../src/index'
import type { ExtractSchema } from 'hono/types'
import type { Equal, Expect } from 'hono/utils/types'
import { Type as T } from '@sinclair/typebox'

describe('Types', () => {
  const RequestSchema = T.Object({
    id: T.Never(),
    title: T.String(),
  })

  const PostSchema = T.Object(
    {
      id: T.Never(),
      message: T.String(),
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
  const ParamsSchema = T.Object({
    id: T.String({ examples: ['123'] }),
  })

  const QuerySchema = T.Object({
    age: T.String({ examples: ['42'] }),
  })

  const BodySchema = T.Object(
    {
      sex: T.Union([T.Literal('male'), T.Literal('female')]),
    },
    { $id: 'User' }
  )

  const UserSchema = T.Object(
    {
      id: T.String({ examples: ['123'] }),
      name: T.String().openapi({
        example: 'John Doe',
      }),
      age: T.String({ examples: ['42'] }),
      sex: T.Union([T.Literal('male'), T.Literal('female')], { examples: ['male'] }),
    },
    { $id: 'User' }
  )

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
      assertType<string>(id)

      const { age } = c.req.valid('query')
      assertType<string>(age)

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
        request: {},
        responses: {
          200: {
            content: {
              'application/json': {
                schema: T.Object({
                  updatedAt: T.Date(),
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
