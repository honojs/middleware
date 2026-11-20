import type { Hono } from 'hono'
import { createMiddleware } from 'hono/factory'
import type { ExtractSchema } from 'hono/types'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type { Equal, Expect } from 'hono/utils/types'
import { OpenAPIHono, createRoute, defineOpenAPIRoute, v, $ } from './index'
import type { HonoToOpenAPIHono, MiddlewareToHandlerType, OfHandlerType } from './index'

describe('Types', () => {
  const RequestSchema = v.object({
    id: v.number(),
    title: v.string(),
  })

  const PostSchema = v.pipe(
    v.object({
      id: v.number(),
      message: v.string(),
    }),
    v.openapi('Post')
  )

  const QuerySchema = v.object({ order: v.picklist(['asc', 'desc']) })

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
  const ParamsSchema = v.object({
    id: v.pipe(
      v.string(),
      v.openapi({
        param: {
          name: 'id',
          in: 'path',
        },
        example: '123',
      }),
      v.transform(Number)
    ),
  })

  const QuerySchema = v.object({
    age: v.pipe(
      v.string(),
      v.openapi({
        param: {
          name: 'age',
          in: 'query',
        },
        example: '42',
      }),
      v.transform(Number)
    ),
  })

  const BodySchema = v.pipe(
    v.object({
      sex: v.picklist(['male', 'female']),
    }),
    v.openapi('UserInput')
  )

  const UserSchema = v.pipe(
    v.object({
      id: v.pipe(
        v.number(),
        v.openapi({
          example: 123,
        })
      ),
      name: v.pipe(
        v.string(),
        v.openapi({
          example: 'John Doe',
        })
      ),
      age: v.pipe(
        v.number(),
        v.openapi({
          example: 42,
        })
      ),
      sex: v.pipe(
        v.picklist(['male', 'female']),
        v.openapi({
          example: 'male',
        })
      ),
    }),
    v.openapi('User')
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

describe('Form, header and cookie input types', () => {
  it('Should infer form body input', () => {
    const route = createRoute({
      method: 'post',
      path: '/form',
      request: {
        body: {
          content: {
            'application/x-www-form-urlencoded': {
              schema: v.object({
                name: v.string(),
                tag: v.string(),
              }),
            },
          },
        },
      },
      responses: {
        200: {
          description: 'ok',
        },
      },
    })

    const app = new OpenAPIHono()
    const routes = app.openapi(route, (c) => {
      const form = c.req.valid('form')
      assertType<{ name: string; tag: string }>(form)
      return c.body(null, 200)
    })

    type Input = ExtractSchema<typeof routes>['/form']['$post']['input']
    type verify = Expect<Equal<Input, { form: { name: string; tag: string } }>>
  })

  it('Should infer header and cookie input', () => {
    const route = createRoute({
      method: 'get',
      path: '/secure',
      request: {
        headers: v.object({
          authorization: v.string(),
        }),
        cookies: v.object({
          session: v.string(),
        }),
      },
      responses: {
        200: {
          description: 'ok',
        },
      },
    })

    const app = new OpenAPIHono()
    const routes = app.openapi(route, (c) => {
      const header = c.req.valid('header')
      assertType<{ authorization: string }>(header)

      const cookie = c.req.valid('cookie')
      assertType<{ session: string }>(cookie)

      return c.body(null, 200)
    })

    type Input = ExtractSchema<typeof routes>['/secure']['$get']['input']
    type verify = Expect<
      Equal<Input, { header: { authorization: string } } & { cookie: { session: string } }>
    >
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
                schema: v.object({
                  updatedAt: v.date(),
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

describe('transform from unknown input', () => {
  it('Should not throw type errors', () => {
    const routes = new OpenAPIHono().openapi(
      createRoute({
        method: 'get',
        path: '/api/users/{id}',
        request: {
          params: v.object({
            id: v.pipe(
              v.unknown(),
              v.openapi({ description: 'userId', example: 1 }),
              v.transform(Number)
            ),
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

  it('Should infer Env from router middleware in defineOpenAPIRoute', () => {
    defineOpenAPIRoute({
      route: createRoute({
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
      handler: (c) => {
        c.var.foo
        c.var.bar

        type verifyFoo = Expect<Equal<typeof c.var.foo, string>>
        type verifyBar = Expect<Equal<typeof c.var.bar, number>>

        return c.json({})
      },
    })
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

describe('$', () => {
  it('Should convert Hono instance to OpenAPIHono type', () => {
    const app = $(
      new OpenAPIHono().use(async (_c, next) => {
        await next()
      })
    )
    // Verify app has OpenAPIHono methods (openapi, doc, etc.)
    expectTypeOf(app.openapi).toBeFunction()
    expectTypeOf(app.doc).toBeFunction()
    expectTypeOf(app.getOpenAPIDocument).toBeFunction()
  })
})
