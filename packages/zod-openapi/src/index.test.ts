import type { RouteConfig } from '@asteasolutions/zod-to-openapi'
import type { Context, TypedResponse } from 'hono'
import { accepts } from 'hono/accepts'
import { bearerAuth } from 'hono/bearer-auth'
import { hc } from 'hono/client'
import type { ServerErrorStatusCode } from 'hono/utils/http-status'
import type { JSONValue } from 'hono/utils/types'
import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import { stringify } from 'yaml'
import type { RouteConfigToTypedResponse } from './index'
import { $, OpenAPIHono, createRoute, defineOpenAPIRoute, z } from './index'

describe('Constructor', () => {
  it('Should not require init object', () => {
    expect(() => new OpenAPIHono()).not.toThrow()
  })

  it('Should accept init object', () => {
    const getPath = () => ''
    const app = new OpenAPIHono({ getPath })
    expect(app.getPath).toBe(getPath)
  })

  it('Should accept a defaultHook', () => {
    type FakeEnv = { Variables: { fake: string }; Bindings: { other: number } }
    const app = new OpenAPIHono<FakeEnv>({
      defaultHook: (_result, c) => {
        // Make sure we're passing context types through
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expectTypeOf(c).toMatchTypeOf<Context<FakeEnv, any, any>>()
      },
    })
    expect(app.defaultHook).toBeDefined()
  })
})

describe('Basic - params', () => {
  const ParamsSchema = z.object({
    id: z
      .string()
      .min(4)
      .openapi({
        param: {
          name: 'id',
          in: 'path',
        },
        example: '12345',
      }),
  })

  const UserSchema = z
    .object({
      id: z.string().openapi({
        example: '12345',
      }),
      name: z.string().openapi({
        example: 'John Doe',
      }),
      age: z.number().openapi({
        example: 42,
      }),
    })
    .openapi('User')

  const HeadersSchema = z.object({
    // Header keys must be in lowercase
    authorization: z.string().openapi({
      example: 'Bearer SECRET',
    }),
  })

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
      headers: HeadersSchema,
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
      return c.json(
        {
          id,
          age: 20,
          name: 'Ultra-man',
        },
        200 // You should specify the status code even if it's 200.
      )
    },
    (result, c) => {
      if (!result.success) {
        const res = c.json(
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
    const res = await app.request('/users/12345', {
      headers: {
        Authorization: 'Bearer TOKEN',
      },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      id: '12345',
      age: 20,
      name: 'Ultra-man',
    })
  })

  it('Should return 400 response with correct contents', async () => {
    const res = await app.request('/users/123')
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
              id: { type: 'string', example: '12345' },
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
                schema: { type: 'string', example: '12345', minLength: 4 },
                required: true,
                name: 'id',
                in: 'path',
              },
              {
                schema: { type: 'string', example: 'Bearer SECRET' },
                required: true,
                name: 'authorization',
                in: 'header',
              },
            ],
            responses: {
              '200': {
                description: 'Get the user',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/User' },
                  },
                },
              },
              '400': {
                description: 'Error!',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Error' },
                  },
                },
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
    return c.json({
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
    authorization: z.string(),
    'x-request-id': z.string().uuid(),
  })

  const PongSchema = z
    .object({
      'x-request-id': z.string().uuid(),
      authorization: z.string(),
    })
    .openapi('Post')

  const route = createRoute({
    method: 'get',
    path: '/pong',
    request: {
      headers: HeaderSchema,
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: PongSchema,
          },
        },
        description: 'Pong',
      },
    },
  })

  const app = new OpenAPIHono()

  app.openapi(route, (c) => {
    const headerData = c.req.valid('header')
    return c.json(headerData)
  })

  it('Should return 200 response with correct contents', async () => {
    const res = await app.request('/pong', {
      headers: {
        'x-request-id': '6ec0bd7f-11c0-43da-975e-2a8ad9ebae0b',
        Authorization: 'Bearer helloworld',
      },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      'x-request-id': '6ec0bd7f-11c0-43da-975e-2a8ad9ebae0b',
      authorization: 'Bearer helloworld',
    })
  })

  it('Should return 400 response with correct contents', async () => {
    const res = await app.request('/pong', {
      headers: {
        'x-request-id': 'invalid-strings',
        Authorization: 'Bearer helloworld',
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
    return c.json({
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

  describe('Content-Type application/json', () => {
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
      return c.json({
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

    it('Should return 200 response without a content-type', async () => {
      const req = new Request('http://localhost/posts', {
        method: 'POST',
      })
      const res = await app.request(req)
      expect(res.status).toBe(200)
    })
  })

  describe('Content-Type application/vnd.api+json', () => {
    const route = createRoute({
      method: 'post',
      path: '/posts',
      request: {
        body: {
          content: {
            'application/vnd.api+json': {
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
      return c.json({
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
          'Content-Type': 'application/vnd.api+json',
        },
      })

      const res = await app.request(req)

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({
        id: 123,
        title: 'Good title',
      })
    })

    it('Should return 400 response with correct contents for empty request data', async () => {
      const req = new Request('http://localhost/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/vnd.api+json',
        },
        body: JSON.stringify({}),
      })
      const res = await app.request(req)
      expect(res.status).toBe(400)
    })

    it('Should return 400 response with correct contents for non application/vnd.api+json request', async () => {
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

  describe('required', () => {
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
          required: true,
        },
      },
      responses: {
        200: {
          description: 'Post a post',
        },
      },
    })
    const app = new OpenAPIHono()
    app.openapi(route, (c) => {
      return c.text('Post success')
    })

    it('Should return 400 response since body is required', async () => {
      const res = await app.request('/posts', {
        method: 'POST',
      })
      expect(res.status).toBe(400)
    })
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
    return c.json({
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

  it('Should return 200 response without a content-type', async () => {
    const req = new Request('http://localhost/posts', {
      method: 'POST',
    })
    const res = await app.request(req)
    expect(res.status).toBe(200)
  })

  it('Should return 400 response for invalid form body', async () => {
    const spy = vi.fn()

    const invalidApp = new OpenAPIHono()
    invalidApp.openapi(route, (c) => {
      spy()
      return c.json({ id: 0, title: '' })
    })

    const searchParams = new URLSearchParams()
    searchParams.append('id', '123')

    const req = new Request('http://localhost/posts', {
      method: 'POST',
      body: searchParams,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })

    const res = await invalidApp.request(req)

    expect(res.status).toBe(400)
    expect(spy).not.toHaveBeenCalled()
  })

  describe('required', () => {
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
          required: true,
        },
      },
      responses: {
        200: {
          description: 'Post a post',
        },
      },
    })
    const app = new OpenAPIHono()
    app.openapi(route, (c) => {
      return c.text('Post success')
    })

    it('Should return 400 response since body is required', async () => {
      const res = await app.request('/posts', {
        method: 'POST',
      })
      expect(res.status).toBe(400)
    })
  })
})

describe('JSON and Form', () => {
  const functionInForm = vi.fn()
  const functionInJSON = vi.fn()
  const route = createRoute({
    method: 'post',
    path: '/hello',
    request: {
      body: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: z.custom(() => {
              functionInForm()
              return true
            }),
          },
          'application/json': {
            schema: z.custom(() => {
              functionInJSON()
              return true
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: 'response',
      },
    },
  })

  const app = new OpenAPIHono()

  app.openapi(route, (c) => {
    return c.json(0)
  })

  test('functionInJSON should not be called when the body is Form', async () => {
    const form = new FormData()
    form.append('foo', 'foo')
    await app.request('/hello', {
      method: 'POST',
      body: form,
    })
    expect(functionInForm).toHaveBeenCalled()
    expect(functionInJSON).not.toHaveBeenCalled()
    functionInForm.mockReset()
    functionInJSON.mockReset()
  })
  test('functionInForm should not be called when the body is JSON', async () => {
    await app.request('/hello', {
      method: 'POST',
      body: JSON.stringify({ foo: 'foo' }),
      headers: {
        'content-type': 'application/json',
      },
    })
    expect(functionInForm).not.toHaveBeenCalled()
    expect(functionInJSON).toHaveBeenCalled()
    functionInForm.mockReset()
    functionInJSON.mockReset()
  })
})

describe('JSON and Text response', () => {
  const route = createRoute({
    method: 'get',
    path: '/hello',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({}),
          },
          'text/plain': {
            schema: z.string(),
          },
        },
        description: 'response',
      },
    },
  })

  const app = new OpenAPIHono()

  app.openapi(route, (c) => {
    const mimeTypes = ['application/json', 'text/plain']
    if (
      accepts(c, {
        default: mimeTypes[0],
        header: 'Accept',
        supports: mimeTypes,
      }) === mimeTypes[0]
    ) {
      return c.json({})
    }
    return c.text('')
  })

  test('should respond with JSON fallback', async () => {
    const res = await app.request('/hello', {
      method: 'GET',
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({})
  })
  test('should respond with Text', async () => {
    const res = await app.request('/hello', {
      method: 'GET',
      headers: {
        accept: 'text/plain',
      },
    })
    expect(res.status).toBe(200)
    expect(await res.text()).toEqual('')
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

  const app = new OpenAPIHono()

  app.openapi(route, (c) => {
    const { id } = c.req.valid('param')
    const { age } = c.req.valid('query')
    const { sex } = c.req.valid('json')

    return c.json({
      id,
      age,
      sex,
      name: 'Ultra-man',
    })
  })

  it('Should return 200 response with correct typed contents', async () => {
    const res = await app.request('/users/123?age=42', {
      method: 'PATCH',
      body: JSON.stringify({ sex: 'male' }),
      headers: {
        'Content-Type': 'application/json',
      },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      id: 123,
      age: 42,
      sex: 'male',
      name: 'Ultra-man',
    })
  })

  // @ts-expect-error it should throw an error if the types are wrong
  app.openapi(route, (c) => {
    return c.json({
      id: '123', // should be number
      age: 42,
      sex: 'male' as const,
      name: 'Success',
    })
  })

  // @ts-expect-error it should throw an error if the status code is wrong
  app.openapi(route, (c) => {
    return c.json(
      {
        id: 123,
        age: 42,
        sex: 'male' as const,
        name: 'Success',
      },
      404
    )
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
  it('Should include definitions from nested routers', async () => {
    const router = new OpenAPIHono().openapi(route, (ctx) => {
      return ctx.json({ id: 123 })
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

    const res = await app.request('/api/posts', {
      method: 'POST',
      body: JSON.stringify({ id: 123 }),
      headers: {
        'Content-Type': 'application/json',
      },
    })
    expect(res.status).toBe(200)
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
        description: "Get the user's tag",
      },
    },
  })

  const app = new OpenAPIHono()

  app.openapi(route, (c) => {
    const { id, tagName } = c.req.valid('param')
    return c.json({
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

describe('basePath()', () => {
  const route = createRoute({
    method: 'get',
    path: '/message',
    responses: {
      200: {
        description: 'Get message',
      },
    },
  })

  const app = new OpenAPIHono().basePath('/api')
  app.openapi(route, (c) => c.json({ message: 'Hello' }))
  app.doc('/doc', {
    openapi: '3.0.0',
    info: {
      version: '1.0.0',
      title: 'My API',
    },
  })

  it('Should return 200 response without type errors - /api/message', async () => {
    const res = await app.request('/api/message')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ message: 'Hello' })
  })

  it('Should return 200 response - /api/doc', async () => {
    const res = await app.request('/api/doc')
    expect(res.status).toBe(200)
  })

  it('Should retain defaultHook of the parent app', async () => {
    const defaultHook = () => {}
    const app = new OpenAPIHono({
      defaultHook,
    }).basePath('/api')
    expect(app.defaultHook).toBeDefined()
    expect(app.defaultHook).toBe(defaultHook)
  })

  it('Should include base path in typings', () => {
    const routes = new OpenAPIHono()
      .basePath('/api')
      .openapi(route, (c) => c.json({ message: 'Hello' }))

    const client = hc<typeof routes>('http://localhost/')

    expect(client.api.message.$url().pathname).toBe('/api/message')
  })

  it('Should add the base path to paths', async () => {
    const res = await app.request('/api/doc')
    expect(res.status).toBe(200)
    const data = (await res.json()) as any
    expect(Object.keys(data.paths)[0]).toBe('/api/message')
  })

  it('Should add nested base paths to openapi schema', async () => {
    const app = new OpenAPIHono()

    const v1 = new OpenAPIHono().basePath('/api/v1')
    v1.openapi(
      {
        method: 'get',
        path: '/message1',
        responses: {
          200: {
            description: 'Get message',
            content: {
              'application/json': {
                schema: z.object({ message: z.string() }),
              },
            },
          },
        },
      },
      (c) => c.json({ message: 'Hello' })
    )

    const v2 = new OpenAPIHono().basePath('/api/v2')
    v2.openapi(
      {
        method: 'get',
        path: '/message2',
        responses: {
          200: {
            description: 'Get message',
            content: {
              'application/json': {
                schema: z.object({ message: z.string() }),
              },
            },
          },
        },
      },
      (c) => c.json({ message: 'Hello' })
    )

    app.route('/', v1)
    app.route('/', v2)

    app.openapi(
      {
        method: 'get',
        path: '/hello',
        responses: {
          200: {
            description: 'Get message',
            content: {
              'application/json': {
                schema: z.object({ message: z.string() }),
              },
            },
          },
        },
      },
      (c) => c.json({ message: 'Hello' })
    )

    const res1 = await app.request('/api/v1/message1')
    expect(res1.status).toBe(200)

    const res2 = await app.request('/api/v2/message2')
    expect(res2.status).toBe(200)

    const json = app.getOpenAPIDocument({
      openapi: '3.0.0',
      info: {
        version: '1.0.0',
        title: 'My API',
      },
    })

    const paths = Object.keys(json.paths)

    expect(paths).toStrictEqual(['/api/v1/message1', '/api/v2/message2', '/hello'])

    expect(paths).not.toStrictEqual(['/message1', '/message2', '/hello'])
  })

  it('Should correctly handle path parameters in basePath', async () => {
    const app = new OpenAPIHono().basePath('/:param')

    app.openapi(
      createRoute({
        method: 'get',
        path: '/',
        responses: {
          200: {
            description: 'Get message',
          },
        },
      }),
      (c) => {
        return c.json({ path: c.req.param('param') })
      }
    )

    const json = app.getOpenAPIDocument({
      openapi: '3.0.0',
      info: {
        version: '1.0.0',
        title: 'My API',
      },
    })

    const paths = Object.keys(json.paths)

    expect(paths).toStrictEqual(['/{param}'])

    const res = await app.request('/abc')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ path: 'abc' })
  })

  it('Should correctly handle path parameters in nested basePath', async () => {
    const app = new OpenAPIHono()
    const nested = new OpenAPIHono().basePath('/:param2')

    nested.openapi(
      createRoute({
        method: 'get',
        path: '/{param3}',
        responses: {
          200: {
            description: 'Get message',
          },
        },
      }),
      (c) => {
        return c.json({
          param1: c.req.param('param1'),
          param2: c.req.param('param2'),
          param3: c.req.param('param3'),
        })
      }
    )

    app.route('/:param1', nested)

    const json = app.getOpenAPIDocument({
      openapi: '3.0.0',
      info: {
        version: '1.0.0',
        title: 'My API',
      },
    })

    const paths = Object.keys(json.paths)

    expect(paths).toStrictEqual(['/{param1}/{param2}/{param3}'])
    expect(paths).not.toStrictEqual(['/{param1}/:param2/{param3}'])

    const res = await app.request('/foo/bar/baz')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      param1: 'foo',
      param2: 'bar',
      param3: 'baz',
    })
  })

  it('Should include base path in typings for doc()', () => {
    const routes = new OpenAPIHono().basePath('/api').doc('/doc', {
      openapi: '3.0.0',
      info: {
        title: 'My API',
        version: '1.0.0',
      },
    })
    const client = hc<typeof routes>('http://localhost/')
    expect(client.api.doc.$url().pathname).toBe('/api/doc')
  })

  it('Should include base path in typings for doc31()', () => {
    const routes = new OpenAPIHono().basePath('/api').doc31('/doc31', {
      openapi: '3.1.0',
      info: {
        title: 'My API',
        version: '1.0.0',
      },
    })
    const client = hc<typeof routes>('http://localhost/')
    expect(client.api.doc31.$url().pathname).toBe('/api/doc31')
  })
})

describe('onError() and onNotFound()', () => {
  const app = new OpenAPIHono()

  const onErrorRoute = app.onError((err, c) => {
    return c.json(
      {
        message: 'Custom error: ' + err.message,
      },
      500
    )
  })
  const onNotFoundRoute = app.notFound((c) => {
    return c.json(
      {
        message: 'Custom not found',
      },
      404
    )
  })

  app.openapi(
    createRoute({
      method: 'get',
      path: '/error',
      responses: {
        500: {
          description: 'An error route',
        },
      },
    }),
    () => {
      throw new Error('Something went wrong')
    }
  )

  it('Should handle errors with onError handler with correct typings', async () => {
    expectTypeOf<typeof onErrorRoute>().toEqualTypeOf<OpenAPIHono>()
    const res = await app.request('/error')
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({
      message: 'Custom error: Something went wrong',
    })
  })

  it('Should handle not found with onNotFound handler with correct typings', async () => {
    expectTypeOf<typeof onNotFoundRoute>().toEqualTypeOf<OpenAPIHono>()
    const res = await app.request('/not-found')
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({
      message: 'Custom not found',
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
        return c.json(0)
      })
      .openapi(createBookRoute, (c) => {
        return c.json(0)
      })

    const client = hc<typeof routes>('http://localhost/')

    it('Should return correct URL without type errors', () => {
      expect(client.posts.$url().pathname).toBe('/posts')
      expect(client.books.$url().pathname).toBe('/books')
    })
  })

  describe('defaultHook', () => {
    const app = new OpenAPIHono({
      defaultHook: (result, c) => {
        if (!result.success) {
          const res = c.json(
            {
              ok: false,
              source: 'defaultHook',
            },
            400
          )
          return res
        }
      },
    })

    const TitleSchema = z.object({
      title: z.string().openapi({}),
    })

    function errorResponse() {
      return {
        400: {
          content: {
            'application/json': {
              schema: z.object({
                ok: z.boolean().openapi({}),
                source: z.enum(['routeHook', 'defaultHook']).openapi({}),
              }),
            },
          },
          description: 'A validation error',
        },
      } satisfies RouteConfig['responses']
    }

    const createPostRoute = createRoute({
      method: 'post',
      path: '/posts',
      operationId: 'createPost',
      request: {
        body: {
          content: {
            'application/json': {
              schema: TitleSchema,
            },
          },
        },
      },
      responses: {
        200: {
          content: {
            'application/json': {
              schema: TitleSchema,
            },
          },
          description: 'A post',
        },
        ...errorResponse(),
      },
    })
    const createBookRoute = createRoute({
      method: 'post',
      path: '/books',
      operationId: 'createBook',
      request: {
        body: {
          content: {
            'application/json': {
              schema: TitleSchema,
            },
          },
        },
      },
      responses: {
        200: {
          content: {
            'application/json': {
              schema: TitleSchema,
            },
          },
          description: 'A book',
        },
        ...errorResponse(),
      },
    })

    // use the defaultHook
    app.openapi(createPostRoute, (c) => {
      const { title } = c.req.valid('json')
      return c.json({ title }, 200)
    })

    // use a routeHook
    app.openapi(
      createBookRoute,
      (c) => {
        const { title } = c.req.valid('json')
        return c.json({ title }, 200)
      },
      (result, c) => {
        if (!result.success) {
          return c.json(
            {
              ok: false,
              source: 'routeHook' as const,
            },
            400
          )
        }
      }
    )

    it('uses the defaultHook', async () => {
      const res = await app.request('/posts', {
        method: 'POST',
        body: JSON.stringify({ bad: 'property' }),
        headers: {
          'Content-Type': 'application/json',
        },
      })
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({
        ok: false,
        source: 'defaultHook',
      })
    })

    it('it uses the route hook instead of the defaultHook', async () => {
      const res = await app.request('/books', {
        method: 'POST',
        body: JSON.stringify({ bad: 'property' }),
        headers: {
          'Content-Type': 'application/json',
        },
      })
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({
        ok: false,
        source: 'routeHook',
      })
    })
  })
})

describe('It allows the response type to be Response', () => {
  const app = new OpenAPIHono()

  app.openapi(
    createRoute({
      method: 'get',
      path: '/no-content',
      responses: {
        204: {
          description: 'No Content',
        },
      },
    }),
    (c) => {
      return c.body(null, 204)
    }
  )

  it('should return a 204 response without a type error', async () => {
    const res = await app.request('/no-content')
    expect(res.status).toBe(204)
    expect(res.body).toBe(null)
  })
})

describe('Path normalization', () => {
  const createRootApp = () => {
    const app = new OpenAPIHono()
    app.doc('/doc', {
      openapi: '3.0.0',
      info: {
        version: '1.0.0',
        title: 'My API',
      },
    })
    return app
  }

  const generateRoute = (path: string) => {
    return createRoute({
      path,
      method: 'get',
      responses: {
        204: {
          description: 'No Content',
        },
      },
    })
  }

  const handler = (c: Context) => c.body(null, 204)

  describe('Duplicate slashes in the root path', () => {
    const app = createRootApp()
    const childApp = new OpenAPIHono()

    childApp.openapi(generateRoute('/child'), handler)
    app.route('/', childApp)

    it('Should remove duplicate slashes', async () => {
      const res = await app.request('/doc')
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({
        openapi: '3.0.0',
        info: {
          version: '1.0.0',
          title: 'My API',
        },
        components: {
          schemas: {},
          parameters: {},
        },
        paths: {
          '/child': {
            get: {
              responses: {
                204: {
                  description: 'No Content',
                },
              },
            },
          },
        },
      })
    })
  })

  describe('Duplicate slashes in the child path', () => {
    const app = createRootApp()
    const childApp = new OpenAPIHono()
    const grandchildApp = new OpenAPIHono()

    grandchildApp.openapi(generateRoute('/granchild'), handler)
    childApp.route('/', grandchildApp)
    app.route('/api', childApp)

    it('Should remove duplicate slashes', async () => {
      const res = await app.request('/doc')
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({
        openapi: '3.0.0',
        info: {
          version: '1.0.0',
          title: 'My API',
        },
        components: {
          schemas: {},
          parameters: {},
        },
        paths: {
          '/api/granchild': {
            get: {
              responses: {
                204: {
                  description: 'No Content',
                },
              },
            },
          },
        },
      })
    })
  })

  describe('Duplicate slashes in the trailing path', () => {
    const app = createRootApp()
    const childApp = new OpenAPIHono()
    const grandchildApp = new OpenAPIHono()

    grandchildApp.openapi(generateRoute('/'), handler)
    childApp.route('/', grandchildApp)
    app.route('/api', childApp)

    it('Should remove duplicate slashes', async () => {
      const res = await app.request('/doc')
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({
        openapi: '3.0.0',
        info: {
          version: '1.0.0',
          title: 'My API',
        },
        components: {
          schemas: {},
          parameters: {},
        },
        paths: {
          '/api': {
            get: {
              responses: {
                204: {
                  description: 'No Content',
                },
              },
            },
          },
        },
      })
    })
  })
})

describe('Context can be accessible in the doc route', () => {
  const app = new OpenAPIHono<{ Bindings: { TITLE: string } }>()

  app.openapi(
    createRoute({
      method: 'get',
      path: '/no-content',
      responses: {
        204: {
          description: 'No Content',
        },
      },
    }),
    (c) => {
      return c.body(null, 204)
    }
  )

  app.doc('/doc', (context) => ({
    openapi: '3.0.0',
    info: {
      version: '1.0.0',
      title: context.env.TITLE,
    },
  }))

  it('Should return with the title set as specified in env', async () => {
    const res = await app.request('/doc', undefined, { TITLE: 'My API' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      openapi: '3.0.0',
      info: {
        version: '1.0.0',
        title: 'My API',
      },
      components: {
        schemas: {},
        parameters: {},
      },
      paths: {
        '/no-content': {
          get: {
            responses: {
              204: {
                description: 'No Content',
              },
            },
          },
        },
      },
    })
  })
})

describe('Named params in nested routes', () => {
  const root = new OpenAPIHono()
  root.doc('/doc', () => ({
    openapi: '3.0.0',
    info: {
      version: '1.0.0',
      title: 'my API',
    },
  }))

  const sub = new OpenAPIHono()
  sub.openapi(
    createRoute({
      method: 'get',
      path: '/sub/{subId}',
      responses: {
        200: {
          description: 'Nested response',
        },
      },
    }),
    (c) => c.json({ params: c.req.param() })
  )

  root.route('/root/:rootId', sub)

  it('Should return a correct content', async () => {
    const res = await root.request('/root/123/sub/456')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual({
      params: {
        subId: '456',
        rootId: '123',
      },
    })
  })

  it('Should return a correct path', async () => {
    const res = await root.request('/doc')
    expect(res.status).toBe(200)
    const data = (await res.json()) as { paths: string[] }
    expect(Object.keys(data['paths'])[0]).toBe('/root/{rootId}/sub/{subId}')
  })
})

describe('Handle "Conflicting names for parameter"', () => {
  const app = new OpenAPIHono()
  app.openapi(
    createRoute({
      method: 'get',
      path: '/posts/{foo}', // should be `id`
      request: {
        params: z.object({
          id: z.string().openapi({
            param: {
              name: 'foo',
              in: 'path',
            },
          }),
        }),
      },
      responses: {
        200: {
          description: 'response',
        },
      },
    }),
    (c) => c.text('foo')
  )

  app.doc('/doc', () => ({
    openapi: '3.0.0',
    info: {
      version: '1.0.0',
      title: 'my API',
    },
  }))

  app.doc31('/doc31', () => ({
    openapi: '3.1.0',
    info: {
      version: '1.0.0',
      title: 'my API',
    },
  }))

  it('Should return a 500 response correctly - /doc', async () => {
    const res = await app.request('/doc')
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data).toEqual({
      data: {
        key: 'name',
        values: ['id', 'foo'],
      },
      message: 'Conflicting names for parameter',
    })
  })

  it('Should return a 500 response correctly - /doc31', async () => {
    const res = await app.request('/doc31')
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data).toEqual({
      data: {
        key: 'name',
        values: ['id', 'foo'],
      },
      message: 'Conflicting names for parameter',
    })
  })
})

describe('doc31 with generator options', () => {
  const app = new OpenAPIHono()

  const route = createRoute({
    method: 'get',
    path: '/hello',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.union([z.literal('hello'), z.literal('world')]),
          },
        },
        description: 'Retrieve the user',
      },
    },
  })

  app.openapi(route, (c) => {
    return c.json('hello' as const, 200)
  })

  it('Should set the unionPreferredType', async () => {
    app.doc31(
      '/doc',
      {
        openapi: '3.1.0',
        info: {
          version: '1.0.0',
          title: 'my API',
        },
      },
      { unionPreferredType: 'anyOf' }
    )

    const res = await app.request('/doc')
    expect(res.status).toBe(200)
    const doc = await res.json()
    expect(
      doc['paths']['/hello']['get']['responses']['200']['content']['application/json']['schema']
    ).toEqual({
      anyOf: [
        { enum: ['hello'], type: 'string' },
        { enum: ['world'], type: 'string' },
      ],
    })
  })
})

describe('Middleware', () => {
  const app = new OpenAPIHono()
  app.openapi(
    createRoute({
      method: 'get',
      path: '/books',
      middleware: [
        (c, next) => {
          c.header('x-foo', 'bar')
          return next()
        },
      ],
      responses: {
        200: {
          description: 'response',
        },
      },
    }),
    (c) => c.text('foo')
  )

  it('Should have the header set by the middleware', async () => {
    const res = await app.request('/books')
    expect(res.status).toBe(200)
    expect(res.headers.get('x-foo')).toBe('bar')
  })
})

describe('RouteConfigToTypedResponse', () => {
  const ParamsSchema = z.object({
    id: z
      .string()
      .min(4)
      .openapi({
        param: {
          name: 'id',
          in: 'path',
        },
        example: '12345',
      }),
  })
  const UserSchema = z
    .object({
      name: z.string().openapi({
        example: 'John Doe',
      }),
      age: z.number().openapi({
        example: 42,
      }),
      hobbies: z.record(z.string(), z.unknown()).array(),
    })
    .openapi('User')

  const ErrorSchema = z
    .object({
      ok: z.boolean().openapi({
        example: false,
      }),
    })
    .openapi('Error')

  it('Should return types correctly', () => {
    const route = {
      method: 'post',
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
        '5XX': {
          content: {
            'application/json': {
              schema: ErrorSchema,
            },
          },
          description: 'Server Error!',
        },
      },
    } satisfies RouteConfig

    type Actual = RouteConfigToTypedResponse<typeof route>

    type Expected =
      | TypedResponse<
          {
            name: string
            age: number
            hobbies: Record<string, JSONValue>[]
          },
          200,
          'json'
        >
      | TypedResponse<
          {
            ok: boolean
          },
          400,
          'json'
        >
      | TypedResponse<
          {
            ok: boolean
          },
          ServerErrorStatusCode,
          'json'
        >
    expectTypeOf<Actual>().toEqualTypeOf<Expected>()
  })
})

describe('Generate YAML', () => {
  it('Should generate YAML with Middleware', async () => {
    const app = new OpenAPIHono()
    app.openapi(
      createRoute({
        method: 'get',
        path: '/books',
        middleware: [
          bearerAuth({
            verifyToken: (_, __) => {
              return true
            },
          }),
        ],
        responses: {
          200: {
            description: 'Books',
            content: {
              'application/json': {
                schema: z.array(
                  z.object({
                    title: z.string(),
                  })
                ),
              },
            },
          },
        },
      }),
      (c) => c.json([{ title: 'foo' }])
    )
    const doc = app.getOpenAPI31Document({
      openapi: '3.1.0',
      info: {
        title: 'My API',
        version: '1.0.0',
      },
    })
    expect(() => stringify(doc)).to.not.throw()
  })
})

describe('Hide Routes', () => {
  const app = new OpenAPIHono()
  app.openapi(
    createRoute({
      method: 'get',
      hide: true,
      path: '/books',
      responses: {
        200: {
          description: 'Books',
          content: {
            'application/json': {
              schema: z.array(
                z.object({
                  title: z.string(),
                })
              ),
            },
          },
        },
      },
    }),
    (c) => c.json([{ title: 'foo' }])
  )

  it('Should hide the route', async () => {
    const doc = app.getOpenAPIDocument({
      openapi: '3.0.0',
      info: {
        title: 'My API',
        version: '1.0.0',
      },
    })

    const doc31 = app.getOpenAPI31Document({
      openapi: '3.1.0',
      info: {
        title: 'My API',
        version: '1.0.0',
      },
    })
    expect(doc.paths).not.toHaveProperty('/books')
    expect(doc31.paths).not.toHaveProperty('/books')
  })

  it('Should return a HTTP 200 response from a hidden route', async () => {
    const res = await app.request('/books')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([{ title: 'foo' }])
  })
})

describe('$', () => {
  it('Should convert Hono instance to OpenAPIHono type', async () => {
    const app = $(
      new OpenAPIHono().get((c) => {
        return c.json({ message: 'Hello' })
      })
    )
    const res = await app.request('/')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ message: 'Hello' })
  })
})

describe('defineOpenAPIRoute', () => {
  it('Should return the route definition as-is', () => {
    const route = createRoute({
      method: 'get',
      path: '/users/{id}',
      request: {
        params: z.object({
          id: z.string().openapi({
            param: {
              name: 'id',
              in: 'path',
            },
          }),
        }),
      },
      responses: {
        200: {
          content: {
            'application/json': {
              schema: z.object({
                id: z.string(),
                name: z.string(),
              }),
            },
          },
          description: 'Get user',
        },
      },
    })

    const handler = (c: Context) => {
      return c.json({ id: '1', name: 'John' }, 200)
    }

    const definition = defineOpenAPIRoute({
      route,
      handler,
    })

    expect(definition).toEqual({ route, handler })
    expect(definition.route).toBe(route)
    expect(definition.handler).toBe(handler)
  })

  it('Should preserve types for route with body and query', () => {
    const route = createRoute({
      method: 'post',
      path: '/users',
      request: {
        query: z.object({
          filter: z.string().optional(),
        }),
        body: {
          content: {
            'application/json': {
              schema: z.object({
                name: z.string(),
                email: z.email(),
              }),
            },
          },
        },
      },
      responses: {
        201: {
          content: {
            'application/json': {
              schema: z.object({
                id: z.string(),
              }),
            },
          },
          description: 'User created',
        },
      },
    })

    const definition = defineOpenAPIRoute({
      route,
      handler: (c) => {
        const { name, email } = c.req.valid('json')
        const { filter } = c.req.valid('query')
        expectTypeOf(name).toEqualTypeOf<string>()
        expectTypeOf(email).toEqualTypeOf<string>()
        expectTypeOf(filter).toEqualTypeOf<string | undefined>()
        return c.json({ id: '123' }, 201)
      },
    })

    expect(definition.route).toBe(route)
  })

  it('Should work with hook', () => {
    const route = createRoute({
      method: 'get',
      path: '/test',
      responses: {
        200: {
          content: {
            'application/json': {
              schema: z.object({ ok: z.boolean() }),
            },
          },
          description: 'Test response',
        },
      },
    })

    const hook = vi.fn()

    const definition = defineOpenAPIRoute({
      route,
      handler: (c) => c.json({ ok: true }, 200),
      hook,
    })

    expect(definition.hook).toBe(hook)
  })

  it('Should work with headers and cookies', () => {
    const route = createRoute({
      method: 'get',
      path: '/auth',
      request: {
        headers: z.object({
          authorization: z.string(),
        }),
        cookies: z.object({
          session: z.string(),
        }),
      },
      responses: {
        200: {
          content: {
            'application/json': {
              schema: z.object({
                authenticated: z.boolean(),
              }),
            },
          },
          description: 'Auth status',
        },
      },
    })

    const definition = defineOpenAPIRoute({
      route,
      handler: (c) => {
        const { authorization } = c.req.valid('header')
        const { session } = c.req.valid('cookie')
        expectTypeOf(authorization).toEqualTypeOf<string>()
        expectTypeOf(session).toEqualTypeOf<string>()
        return c.json({ authenticated: true }, 200)
      },
    })

    expect(definition.route).toBe(route)
  })

  it('Should preserve middleware in route config', () => {
    const middleware = bearerAuth({ token: 'secret' })
    const route = createRoute({
      method: 'get',
      path: '/protected',
      middleware,
      responses: {
        200: {
          content: {
            'application/json': {
              schema: z.object({ data: z.string() }),
            },
          },
          description: 'Protected data',
        },
      },
    })

    const definition = defineOpenAPIRoute({
      route,
      handler: (c) => c.json({ data: 'secret' }, 200),
    })

    expect(definition.route.middleware).toBe(middleware)
  })
})

describe('openapiRoutes', () => {
  it('Should register a single route', async () => {
    const route = defineOpenAPIRoute({
      route: createRoute({
        method: 'get',
        path: '/hello',
        responses: {
          200: {
            content: {
              'application/json': {
                schema: z.object({
                  message: z.string(),
                }),
              },
            },
            description: 'Hello response',
          },
        },
      }),
      handler: (c) => c.json({ message: 'Hello World' }, 200),
    })

    const app = new OpenAPIHono().openapiRoutes([route])

    const res = await app.request('/hello')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ message: 'Hello World' })
  })

  it('Should register multiple routes', async () => {
    const getRoute = defineOpenAPIRoute({
      route: createRoute({
        method: 'get',
        path: '/users',
        responses: {
          200: {
            content: {
              'application/json': {
                schema: z.array(z.object({ id: z.string(), name: z.string() })),
              },
            },
            description: 'List users',
          },
        },
      }),
      handler: (c) => c.json([{ id: '1', name: 'Alice' }], 200),
    })

    const postRoute = defineOpenAPIRoute({
      route: createRoute({
        method: 'post',
        path: '/users',
        request: {
          body: {
            content: {
              'application/json': {
                schema: z.object({
                  name: z.string(),
                }),
              },
            },
          },
        },
        responses: {
          201: {
            content: {
              'application/json': {
                schema: z.object({ id: z.string() }),
              },
            },
            description: 'User created',
          },
        },
      }),
      handler: (c) => c.json({ id: '2' }, 201),
    })
    const app = new OpenAPIHono().openapiRoutes([getRoute, postRoute])

    const getRes = await app.request('/users')
    expect(getRes.status).toBe(200)
    expect(await getRes.json()).toEqual([{ id: '1', name: 'Alice' }])

    const postRes = await app.request('/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Bob' }),
    })
    expect(postRes.status).toBe(201)
    expect(await postRes.json()).toEqual({ id: '2' })
  })

  it('Should work with different HTTP methods', async () => {
    const app = new OpenAPIHono().openapiRoutes([
      defineOpenAPIRoute({
        route: createRoute({
          method: 'get',
          path: '/resource',
          responses: {
            200: {
              content: {
                'application/json': {
                  schema: z.object({ data: z.string() }),
                },
              },
              description: 'Get resource',
            },
          },
        }),
        handler: (c) => c.json({ data: 'get' }, 200),
      }),
      defineOpenAPIRoute({
        route: createRoute({
          method: 'post',
          path: '/resource',
          responses: {
            201: {
              content: {
                'application/json': {
                  schema: z.object({ data: z.string() }),
                },
              },
              description: 'Create resource',
            },
          },
        }),
        handler: (c) => c.json({ data: 'post' }, 201),
      }),
      defineOpenAPIRoute({
        route: createRoute({
          method: 'put',
          path: '/resource',
          responses: {
            200: {
              content: {
                'application/json': {
                  schema: z.object({ data: z.string() }),
                },
              },
              description: 'Update resource',
            },
          },
        }),
        handler: (c) => c.json({ data: 'put' }, 200),
      }),
      defineOpenAPIRoute({
        route: createRoute({
          method: 'delete',
          path: '/resource',
          responses: {
            204: {
              description: 'Delete resource',
            },
          },
        }),
        handler: (c) => c.body(null, 204),
      }),
    ] as const)

    const getRes = await app.request('/resource', { method: 'GET' })
    expect(getRes.status).toBe(200)
    expect(await getRes.json()).toEqual({ data: 'get' })

    const postRes = await app.request('/resource', { method: 'POST' })
    expect(postRes.status).toBe(201)
    expect(await postRes.json()).toEqual({ data: 'post' })

    const putRes = await app.request('/resource', { method: 'PUT' })
    expect(putRes.status).toBe(200)
    expect(await putRes.json()).toEqual({ data: 'put' })

    const deleteRes = await app.request('/resource', { method: 'DELETE' })
    expect(deleteRes.status).toBe(204)
  })

  it('Should handle routes with parameters', async () => {
    const route = defineOpenAPIRoute({
      route: createRoute({
        method: 'get',
        path: '/items/{id}',
        request: {
          params: z.object({
            id: z.string().openapi({
              param: {
                name: 'id',
                in: 'path',
              },
            }),
          }),
        },
        responses: {
          200: {
            content: {
              'application/json': {
                schema: z.object({
                  id: z.string(),
                  name: z.string(),
                }),
              },
            },
            description: 'Get item',
          },
        },
      }),
      handler: (c) => {
        const { id } = c.req.valid('param')
        return c.json({ id, name: `Item ${id}` }, 200)
      },
    })

    const app = new OpenAPIHono().openapiRoutes([route])

    const res = await app.request('/items/123')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: '123', name: 'Item 123' })
  })

  it('Should handle routes with hooks', async () => {
    const hookFn = vi.fn((result, c) => {
      if (!result.success) {
        return c.json({ error: 'Validation failed' }, 400)
      }
    })

    const route = defineOpenAPIRoute({
      route: createRoute({
        method: 'post',
        path: '/validate',
        request: {
          body: {
            content: {
              'application/json': {
                schema: z.object({
                  value: z.number().min(1),
                }),
              },
            },
          },
        },
        responses: {
          200: {
            content: {
              'application/json': {
                schema: z.object({ ok: z.boolean() }),
              },
            },
            description: 'Success',
          },
        },
      }),
      handler: (c) => c.json({ ok: true }, 200),
      hook: hookFn,
    })

    const app = new OpenAPIHono().openapiRoutes([route])

    // Valid request
    const validRes = await app.request('/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 5 }),
    })
    expect(validRes.status).toBe(200)
    expect(hookFn).toHaveBeenCalled()

    // Invalid request
    const invalidRes = await app.request('/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 0 }),
    })
    expect(invalidRes.status).toBe(400)
    expect(await invalidRes.json()).toEqual({ error: 'Validation failed' })
  })

  it('Should register routes in OpenAPI registry', () => {
    const routes = [
      defineOpenAPIRoute({
        route: createRoute({
          method: 'get',
          path: '/api/users',
          responses: {
            200: {
              content: {
                'application/json': {
                  schema: z.array(z.object({ id: z.string() })),
                },
              },
              description: 'List users',
            },
          },
        }),
        handler: (c) => c.json([], 200),
      }),
      defineOpenAPIRoute({
        route: createRoute({
          method: 'get',
          path: '/api/posts',
          responses: {
            200: {
              content: {
                'application/json': {
                  schema: z.array(z.object({ id: z.string() })),
                },
              },
              description: 'List posts',
            },
          },
        }),
        handler: (c) => c.json([], 200),
      }),
    ] as const

    const app = new OpenAPIHono().openapiRoutes(routes)

    const doc = app.getOpenAPIDocument({
      openapi: '3.0.0',
      info: {
        title: 'Test API',
        version: '1.0.0',
      },
    })

    expect(doc.paths).toHaveProperty('/api/users')
    expect(doc.paths).toHaveProperty('/api/posts')
    expect(doc.paths['/api/users']).toHaveProperty('get')
    expect(doc.paths['/api/posts']).toHaveProperty('get')
  })

  it('Should work with RPC client', async () => {
    const routes = [
      defineOpenAPIRoute({
        route: createRoute({
          method: 'get',
          path: '/api/status',
          responses: {
            200: {
              content: {
                'application/json': {
                  schema: z.object({
                    status: z.string(),
                    uptime: z.number(),
                  }),
                },
              },
              description: 'API status',
            },
          },
        }),
        handler: (c) => c.json({ status: 'ok', uptime: 12345 }, 200),
      }),
      defineOpenAPIRoute({
        route: createRoute({
          method: 'post',
          path: '/api/echo',
          request: {
            body: {
              content: {
                'application/json': {
                  schema: z.object({
                    message: z.string(),
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
                    echo: z.string(),
                  }),
                },
              },
              description: 'Echo response',
            },
          },
        }),
        handler: (c) => {
          const { message } = c.req.valid('json')
          return c.json({ echo: message }, 200)
        },
      }),
    ] as const

    const app = new OpenAPIHono().openapiRoutes(routes)

    const client = hc<typeof app>('http://localhost')

    // Type checking for RPC client
    expectTypeOf(client.api.status.$get).toBeFunction()
    expectTypeOf(client.api.echo.$post).toBeFunction()
  })

  it('Should hide routes when hide property is true', () => {
    const routes = [
      defineOpenAPIRoute({
        route: createRoute({
          method: 'get',
          path: '/public',
          responses: {
            200: {
              content: {
                'application/json': {
                  schema: z.object({ data: z.string() }),
                },
              },
              description: 'Public endpoint',
            },
          },
        }),
        handler: (c) => c.json({ data: 'public' }, 200),
      }),
      defineOpenAPIRoute({
        route: createRoute({
          method: 'get',
          path: '/hidden',
          hide: true,
          responses: {
            200: {
              content: {
                'application/json': {
                  schema: z.object({ data: z.string() }),
                },
              },
              description: 'Hidden endpoint',
            },
          },
        }),
        handler: (c) => c.json({ data: 'hidden' }, 200),
      }),
    ] as const

    const app = new OpenAPIHono().openapiRoutes(routes)

    const doc = app.getOpenAPIDocument({
      openapi: '3.0.0',
      info: {
        title: 'Test API',
        version: '1.0.0',
      },
    })

    expect(doc.paths).toHaveProperty('/public')
    expect(doc.paths).not.toHaveProperty('/hidden')
  })

  it('Should still handle hidden routes at runtime', async () => {
    const route = defineOpenAPIRoute({
      route: createRoute({
        method: 'get',
        path: '/secret',
        hide: true,
        responses: {
          200: {
            content: {
              'application/json': {
                schema: z.object({ secret: z.string() }),
              },
            },
            description: 'Secret data',
          },
        },
      }),
      handler: (c) => c.json({ secret: 'confidential' }, 200),
    })

    const app = new OpenAPIHono().openapiRoutes([route])

    const res = await app.request('/secret')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ secret: 'confidential' })
  })

  it('Should handle routes with middleware', async () => {
    const authMiddleware = bearerAuth({ token: 'secret-token' })

    const route = defineOpenAPIRoute({
      route: createRoute({
        method: 'get',
        path: '/protected',
        middleware: authMiddleware,
        responses: {
          200: {
            content: {
              'application/json': {
                schema: z.object({ data: z.string() }),
              },
            },
            description: 'Protected data',
          },
        },
      }),
      handler: (c) => c.json({ data: 'protected' }, 200),
    })

    const app = new OpenAPIHono().openapiRoutes([route])

    // Without auth
    const unauthedRes = await app.request('/protected')
    expect(unauthedRes.status).toBe(401)

    // With auth
    const authedRes = await app.request('/protected', {
      headers: {
        Authorization: 'Bearer secret-token',
      },
    })
    expect(authedRes.status).toBe(200)
    expect(await authedRes.json()).toEqual({ data: 'protected' })
  })

  it('Should maintain type safety with const assertion', async () => {
    const routes = [
      defineOpenAPIRoute({
        route: createRoute({
          method: 'get',
          path: '/typed',
          responses: {
            200: {
              content: {
                'application/json': {
                  schema: z.object({
                    id: z.number(),
                    name: z.string(),
                  }),
                },
              },
              description: 'Typed response',
            },
          },
        }),
        handler: (c) => {
          const response = c.json({ id: 1, name: 'test' }, 200)
          expectTypeOf(response).toMatchTypeOf<
            TypedResponse<{ id: number; name: string }, 200, 'json'>
          >()
          return response
        },
      }),
    ] as const

    const app = new OpenAPIHono().openapiRoutes(routes)

    const res = await app.request('/typed')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 1, name: 'test' })
  })
})
