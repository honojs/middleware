import { Hono } from 'hono'
import { createMiddleware } from 'hono/factory'
import type { ExtractSchema } from 'hono/types'
import type { Equal, Expect } from 'hono/utils/types'
import { OpenAPIHono, createRoute, z } from './index'
import type { HonoToOpenAPIHono, MiddlewareToHandlerType, OfHandlerType } from './index'
import { ContentfulStatusCode } from 'hono/utils/http-status'

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

  const QuerySchema = z.object({ order: z.enum(['asc', 'desc']) })

  const route = createRoute({
    method: 'post',
    path: '/posts',
    request: {
      query: QuerySchema,
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
    const order = c.req.valid('query')
    assertType<{ order: 'asc' | 'desc' }>(order)
    return c.json({
      id: data.id,
      message: 'Success',
      order,
    })
  })

  it('Should return correct types', () => {
    type Expected = {
      '/posts': {
        $post: {
          input: {
            query: {
              order: 'asc' | 'desc'
            }
          } & {
            json: {
              title: string
              id: number
            }
          }
          output: {
            id: number
            message: string
          }
          outputFormat: 'json'
          status: 200
        }
      }
    }

    type Actual = ExtractSchema<typeof appRoutes>
    type verify = Expect<Equal<Expected, Actual>>
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

describe('coerce', () => {
  it('Should not throw type errors', () => {
    const routes = new OpenAPIHono().openapi(
      createRoute({
        method: 'get',
        path: '/api/users/{id}',
        request: {
          params: z.object({
            id: z.coerce.number().openapi({ description: 'userId', example: 1 }),
          }),
        },
        responses: {
          200: {
            description: 'Get a user',
          },
        },
      }),
      (c) => {
        const { id } = c.req.valid('param')
        assertType<number>(id)
        return c.json({ id })
      }
    )

    type Actual = ExtractSchema<typeof routes>['/api/users/:id']['$get']['input']
    type Expected = {
      param: {
        id: unknown
      }
    }
    type verify = Expect<Equal<Expected, Actual>>
  })
})

describe('Middleware', () => {
  it('Should merge Env', async () => {
    const middlewareA = createMiddleware<{
      Variables: { foo: string }
    }>(async (c, next) => {
      c.set('foo', 'abc')
      next()
    })

    const middlewareB = createMiddleware<{
      Variables: { bar: number }
    }>(async (c, next) => {
      c.set('bar', 321)
      next()
    })

    type Example = MiddlewareToHandlerType<[typeof middlewareA, typeof middlewareB]>

    type verify = Expect<
      Equal<
        OfHandlerType<Example>['env'],
        {
          Variables: { foo: string; bar: number }
        }
      >
    >
  })

  it('Should infer Env from router middleware', async () => {
    const app = new OpenAPIHono<{ Variables: { too: symbol } }>()
    app.openapi(
      createRoute({
        method: 'get',
        path: '/books',
        middleware: [
          createMiddleware<{
            Variables: { foo: string }
          }>((c, next) => {
            c.set('foo', 'abc')
            return next()
          }),
          createMiddleware<{
            Variables: { bar: number }
          }>((c, next) => {
            c.set('bar', 321)
            return next()
          }),
        ] as const,
        responses: {
          200: {
            description: 'response',
          },
        },
      }),
      (c) => {
        c.var.foo
        c.var.bar
        c.var.too

        type verifyFoo = Expect<Equal<typeof c.var.foo, string>>
        type verifyBar = Expect<Equal<typeof c.var.bar, number>>
        type verifyToo = Expect<Equal<typeof c.var.too, symbol>>

        return c.json({})
      }
    )
  })

  it('Should infer Env root when no middleware provided', async () => {
    const app = new OpenAPIHono<{ Variables: { too: symbol } }>()
    app.openapi(
      createRoute({
        method: 'get',
        path: '/books',
        middleware: undefined,
        responses: {
          200: {
            description: 'response',
          },
        },
      }),
      (c) => {
        c.var.too

        type verify = Expect<Equal<typeof c.var.too, symbol>>

        return c.json({})
      }
    )
  })

  it('Should infer Env correctly when the middleware is empty', async () => {
    const app = new OpenAPIHono<{ Variables: { foo: string } }>()
    app.openapi(
      createRoute({
        method: 'get',
        path: '/books',
        middleware: [] as const, // empty
        responses: {
          200: {
            description: 'response',
          },
        },
      }),
      (c) => {
        const foo = c.get('foo')
        type verify = Expect<Equal<typeof foo, string>>
        return c.json({})
      }
    )
  })
})

describe('HonoToOpenAPIHono', () => {
  it('Should convert Hono type to OpenAPIHono type', () => {
    type MyHono = Hono<{ Variables: { foo: string } }>
    type MyOpenAPIHono = HonoToOpenAPIHono<MyHono>
    type MyEnv = MyOpenAPIHono extends OpenAPIHono<infer E, infer _S, infer _B> ? E : never
    type verify = Expect<Equal<MyEnv, { Variables: { foo: string } }>>
  })

  it('Should convert return type of get method', () => {
    const app = new OpenAPIHono()
    const result = app.get('/hello', (c) => c.json({ message: 'Hello' }))

    type Expected = {
      '/hello': {
        $get: {
          input: {}
          output: { message: string }
          outputFormat: 'json'
          status: ContentfulStatusCode
        }
      }
    }

    type Actual = ExtractSchema<typeof result>
    type verify = Expect<Equal<Actual, Expected>>
  })
})
