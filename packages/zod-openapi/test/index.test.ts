/* eslint-disable node/no-extraneous-import */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Hono, Env, ToSchema } from 'hono'
import { hc } from 'hono/client'
import { describe, it, expect, expectTypeOf } from 'vitest'
import { OpenAPIHono, createRoute, z } from '../src'

describe('Constructor', () => {
  it('Should not require init object', () => {
    expect(() => new OpenAPIHono()).not.toThrow()
  })

  it('Should accept init object', () => {
    const getPath = () => ''
    const app = new OpenAPIHono({ getPath })
    expect(app.getPath).toBe(getPath)
  })
})

describe('Basic - params', () => {
  const ParamsSchema = z.object({
    id: z
      .string()
      .transform((val, ctx) => {
        const parsed = parseInt(val)
        if (isNaN(parsed)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Not a number',
          })
          return z.NEVER
        }
        return parsed
      })
      .openapi({
        param: {
          name: 'id',
          in: 'path',
        },
        example: 123,
        type: 'integer',
      }),
  })

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
    })
    .openapi('User')

  const ErrorSchema = z
    .object({
      ok: z.boolean().openapi({
        example: false,
      }),
    })
    .openapi('Error')

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
        description: 'Get the user',
      },
      400: {
        content: {
          'application/json': {
            schema: ErrorSchema,
          },
        },
        description: 'Error!',
      },
    },
  })

  const app = new OpenAPIHono()

  app.openapi(
    route,
    (c) => {
      const { id } = c.req.valid('param')
      return c.jsonT({
        id,
        age: 20,
        name: 'Ultra-man',
      })
    },
    (result, c) => {
      if (!result.success) {
        const res = c.jsonT(
          {
            ok: false,
          },
          400
        )
        return res
      }
    }
  )

  app.doc('/doc', {
    openapi: '3.0.0',
    info: {
      version: '1.0.0',
      title: 'My API',
    },
  })

  it('Should return 200 response with correct contents', async () => {
    const res = await app.request('/users/123')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      id: 123,
      age: 20,
      name: 'Ultra-man',
    })
  })

  it('Should return 400 response with correct contents', async () => {
    const res = await app.request('/users/abc')
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ ok: false })
  })

  it('Should return OpenAPI documents', async () => {
    const res = await app.request('/doc')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      openapi: '3.0.0',
      info: { version: '1.0.0', title: 'My API' },
      components: {
        schemas: {
          User: {
            type: 'object',
            properties: {
              id: { type: 'number', example: 123 },
              name: { type: 'string', example: 'John Doe' },
              age: { type: 'number', example: 42 },
            },
            required: ['id', 'name', 'age'],
          },
          Error: {
            type: 'object',
            properties: { ok: { type: 'boolean', example: false } },
            required: ['ok'],
          },
        },
        parameters: {},
      },
      paths: {
        '/users/{id}': {
          get: {
            parameters: [
              {
                schema: { type: 'integer', example: 123 },
                required: true,
                name: 'id',
                in: 'path',
              },
            ],
            responses: {
              '200': {
                description: 'Get the user',
                content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } },
              },
              '400': {
                description: 'Error!',
                content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
              },
            },
          },
        },
      },
    })
  })
})

describe('Query', () => {
  const QuerySchema = z.object({
    page: z.string().openapi({
      example: '123',
    }),
  })

  const BooksSchema = z
    .object({
      titles: z.array(z.string().openapi({})),
      page: z.number().openapi({}),
    })
    .openapi('Post')

  const route = createRoute({
    method: 'get',
    path: '/books',
    request: {
      query: QuerySchema,
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: BooksSchema,
          },
        },
        description: 'Get books',
      },
    },
  })

  const app = new OpenAPIHono()

  app.openapi(route, (c) => {
    const { page } = c.req.valid('query')
    return c.jsonT({
      titles: ['Good title'],
      page: Number(page),
    })
  })

  it('Should return 200 response with correct contents', async () => {
    const res = await app.request('/books?page=123')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      titles: ['Good title'],
      page: 123,
    })
  })

  it('Should return 400 response with correct contents', async () => {
    const res = await app.request('/books')
    expect(res.status).toBe(400)
  })
})

describe('Header', () => {
  const HeaderSchema = z.object({
    'x-request-id': z.string().uuid(),
  })

  const PingSchema = z
    .object({
      'x-request-id': z.string().uuid(),
    })
    .openapi('Post')

  const route = createRoute({
    method: 'get',
    path: '/ping',
    request: {
      headers: HeaderSchema,
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: PingSchema,
          },
        },
        description: 'Ping',
      },
    },
  })

  const app = new OpenAPIHono()

  app.openapi(route, (c) => {
    const headerData = c.req.valid('header')
    const xRequestId = headerData['x-request-id']
    return c.jsonT({
      'x-request-id': xRequestId,
    })
  })

  it('Should return 200 response with correct contents', async () => {
    const res = await app.request('/ping', {
      headers: {
        'x-request-id': '6ec0bd7f-11c0-43da-975e-2a8ad9ebae0b',
      },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      'x-request-id': '6ec0bd7f-11c0-43da-975e-2a8ad9ebae0b',
    })
  })

  it('Should return 400 response with correct contents', async () => {
    const res = await app.request('/ping', {
      headers: {
        'x-request-id': 'invalid-strings',
      },
    })
    expect(res.status).toBe(400)
  })
})

describe('Cookie', () => {
  const CookieSchema = z.object({
    debug: z.enum(['0', '1']),
  })

  const UserSchema = z
    .object({
      name: z.string(),
      debug: z.enum(['0', '1']),
    })
    .openapi('User')

  const route = createRoute({
    method: 'get',
    path: '/api/user',
    request: {
      cookies: CookieSchema,
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: UserSchema,
          },
        },
        description: 'Get a user',
      },
    },
  })

  const app = new OpenAPIHono()

  app.openapi(route, (c) => {
    const { debug } = c.req.valid('cookie')
    return c.jsonT({
      name: 'foo',
      debug,
    })
  })

  it('Should return 200 response with correct contents', async () => {
    const res = await app.request('/api/user', {
      headers: {
        Cookie: 'debug=1',
      },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      name: 'foo',
      debug: '1',
    })
  })

  it('Should return 400 response with correct contents', async () => {
    const res = await app.request('/api/user', {
      headers: {
        Cookie: 'debug=2',
      },
    })
    expect(res.status).toBe(400)
  })
})

describe('JSON', () => {
  const RequestSchema = z.object({
    id: z.number().openapi({}),
    title: z.string().openapi({}),
  })

  const PostSchema = z
    .object({
      id: z.number().openapi({}),
      title: z.string().openapi({}),
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

  app.openapi(route, (c) => {
    const { id, title } = c.req.valid('json')
    return c.jsonT({
      id,
      title,
    })
  })

  it('Should return 200 response with correct contents', async () => {
    const req = new Request('http://localhost/posts', {
      method: 'POST',
      body: JSON.stringify({
        id: 123,
        title: 'Good title',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const res = await app.request(req)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      id: 123,
      title: 'Good title',
    })
  })

  it('Should return 400 response with correct contents', async () => {
    const req = new Request('http://localhost/posts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })
    const res = await app.request(req)
    expect(res.status).toBe(400)
  })
})

describe('Form', () => {
  const RequestSchema = z.object({
    id: z.string().openapi({}),
    title: z.string().openapi({}),
  })

  const PostSchema = z
    .object({
      id: z.number().openapi({}),
      title: z.string().openapi({}),
    })
    .openapi('Post')

  const route = createRoute({
    method: 'post',
    path: '/posts',
    request: {
      body: {
        content: {
          'application/x-www-form-urlencoded': {
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

  app.openapi(route, (c) => {
    const { id, title } = c.req.valid('form')
    return c.jsonT({
      id: Number(id),
      title,
    })
  })

  it('Should return 200 response with correct contents', async () => {
    const searchParams = new URLSearchParams()
    searchParams.append('id', '123')
    searchParams.append('title', 'Good title')
    const req = new Request('http://localhost/posts', {
      method: 'POST',
      body: searchParams,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })

    const res = await app.request(req)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      id: 123,
      title: 'Good title',
    })
  })

  it('Should return 400 response with correct contents', async () => {
    const req = new Request('http://localhost/posts', {
      method: 'POST',
    })
    const res = await app.request(req)
    expect(res.status).toBe(400)
  })
})

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
    return c.jsonT({
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
    expectTypeOf(appRoutes).toMatchTypeOf<H>
  })
})

describe('Routers', () => {
  const RequestSchema = z.object({
    id: z.number().openapi({}),
  })

  const PostSchema = z
    .object({
      id: z.number().openapi({}),
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
  it('Should include definitions from nested routers', () => {
    const router = new OpenAPIHono().openapi(route, (ctx) => {
      return ctx.jsonT({ id: 123 })
    })

    router.openAPIRegistry.register('Id', z.number())

    router.openAPIRegistry.registerParameter(
      'Key',
      z.number().openapi({
        param: { in: 'path' },
      })
    )

    router.openAPIRegistry.registerWebhook({
      method: 'post',
      path: '/postback',
      responses: {
        200: {
          description: 'Receives a post back',
        },
      },
    })

    const app = new OpenAPIHono().route('/api', router)
    const json = app.getOpenAPI31Document({
      openapi: '3.1.0',
      info: {
        title: 'My API',
        version: '1.0.0',
      },
    })

    expect(json.components?.schemas).toHaveProperty('Id')
    expect(json.components?.schemas).toHaveProperty('Post')
    expect(json.components?.parameters).toHaveProperty('Key')
    expect(json.paths).toHaveProperty('/api/posts')
    expect(json.webhooks).toHaveProperty('/api/postback')
  })
})

describe('Multi params', () => {
  const ParamsSchema = z.object({
    id: z.string(),
    tagName: z.string(),
  })

  const route = createRoute({
    method: 'get',
    path: '/users/{id}/tags/{tagName}',
    request: {
      params: ParamsSchema,
    },
    responses: {
      200: {
        // eslint-disable-next-line quotes
        description: "Get the user's tag",
      },
    },
  })

  const app = new OpenAPIHono()

  app.openapi(route, (c) => {
    const { id, tagName } = c.req.valid('param')
    return c.jsonT({
      id,
      tagName,
    })
  })

  it('Should return 200 response with correct contents', async () => {
    const res = await app.request('/users/123/tags/baseball')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      id: '123',
      tagName: 'baseball',
    })
  })
})

describe('With hc', () => {
  describe('Multiple routes', () => {
    const app = new OpenAPIHono()

    const createPostRoute = createRoute({
      method: 'post',
      path: '/posts',
      operationId: 'createPost',
      responses: {
        200: {
          description: 'A post',
        },
      },
    })

    const createBookRoute = createRoute({
      method: 'post',
      path: '/books',
      operationId: 'createBook',
      responses: {
        200: {
          description: 'A book',
        },
      },
    })

    const routes = app
      .openapi(createPostRoute, (c) => {
        return c.jsonT(0)
      })
      .openapi(createBookRoute, (c) => {
        return c.jsonT(0)
      })

    const client = hc<typeof routes>('http://localhost/')

    it('Should return correct URL without type errors', () => {
      expect(client.posts.$url().pathname).toBe('/posts')
      expect(client.books.$url().pathname).toBe('/books')
    })
  })
})
