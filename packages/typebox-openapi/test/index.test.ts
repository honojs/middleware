import { Kind, Type as T, type TSchema, TypeRegistry } from '@sinclair/typebox'
import type { Context, TypedResponse } from 'hono'
import { accepts } from 'hono/accepts'
import { bearerAuth } from 'hono/bearer-auth'
import { hc } from 'hono/client'
import type { Equal, Expect } from 'hono/utils/types'
import { afterAll, describe, expect, expectTypeOf, it, vi } from 'vitest'
import { stringify } from 'yaml'
import type { RouteConfigToTypedResponse } from '../src/index'
import { OpenAPIHono, createRoute } from '../src/index'
import type { OpenAPIRoute } from '../src/types'

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
  const ParamsSchema = T.Object({
    id: T.String({ minLength: 4, examples: ['12345'] }),
  })

  const UserSchema = T.Object(
    {
      id: T.String({ examples: ['12345'] }),
      name: T.String({ examples: ['John Doe'] }),
      age: T.Number({ examples: [42] }),
    },
    { $id: 'User' }
  )

  const HeadersSchema = T.Object({
    // Header keys must be in lowercase
    authorization: T.String({ examples: ['Bearer SECRET'] }),
  })

  const ErrorSchema = T.Object(
    {
      ok: T.Boolean({ examples: [false] }),
    },
    { $id: 'Error' }
  )

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
    documentation: {
      openapi: '3.1.0',
      info: {
        version: '1.0.0',
        title: 'My API',
      },
    },
  })

  it('Should return 200 response with correct contents', async () => {
    const res = await app.request('/users/12345', {
      headers: {
        authorization: 'Bearer TOKEN',
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
      openapi: '3.1.0',
      info: { version: '1.0.0', title: 'My API' },
      components: {
        schemas: {
          User: {
            type: 'object',
            properties: {
              id: { type: 'string', examples: ['12345'] },
              name: { type: 'string', examples: ['John Doe'] },
              age: { type: 'number', examples: [42] },
            },
            required: ['id', 'name', 'age'],
          },
          Error: {
            type: 'object',
            properties: { ok: { type: 'boolean', examples: [false] } },
            required: ['ok'],
          },
        },
      },
      paths: {
        '/users/{id}': {
          get: {
            operationId: 'getUsersById',
            parameters: [
              {
                schema: { type: 'string', examples: ['Bearer SECRET'] },
                required: true,
                name: 'authorization',
                in: 'header',
              },
              {
                schema: { type: 'string', examples: ['12345'], minLength: 4 },
                required: true,
                name: 'id',
                in: 'path',
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
  const QuerySchema = T.Object({
    page: T.String({ examples: ['123'] }),
  })

  const BooksSchema = T.Object(
    {
      titles: T.Array(T.String()),
      page: T.Number(),
    },
    { $id: 'Post' }
  )

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
  const HeaderSchema = T.Object({
    authorization: T.String(),
    'x-request-id': T.String({ format: 'uuid' }),
  })

  const PongSchema = T.Object(
    {
      'x-request-id': T.String({ format: 'uuid' }),
      authorization: T.String(),
    },
    { $id: 'Post' }
  )

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
        AuthoriTation: 'Bearer helloworld',
      },
    })
    expect(res.status).toBe(400)
  })
})

describe('Cookie', () => {
  const CookieSchema = T.Object({
    debug: T.Union([T.Literal('0'), T.Literal('1')]),
  })

  const UserSchema = T.Object(
    {
      name: T.String(),
      debug: T.Union([T.Literal('0'), T.Literal('1')]),
    },
    { $id: 'User' }
  )

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

    it('Should return 400 response without a content-type', async () => {
      const req = new Request('http://localhost/posts', {
        method: 'POST',
      })
      const res = await app.request(req)
      expect(res.status).toBe(400)
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
  const RequestSchema = T.Object({
    id: T.String(),
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

  it('Should return 400 response without a content-type', async () => {
    const req = new Request('http://localhost/posts', {
      method: 'POST',
    })
    const res = await app.request(req)
    expect(res.status).toBe(400)
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
  TypeRegistry.Set('Form', (schema, value) => {
    functionInForm()
    return true
  })
  TypeRegistry.Set('JSON', (schema, value) => {
    functionInJSON()
    return true
  })
  const route = createRoute({
    method: 'post',
    path: '/hello',
    request: {
      body: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: { [Kind]: 'Form' } as TSchema,
          },
          'application/json': {
            schema: { [Kind]: 'JSON' } as TSchema,
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

  afterAll(() => {
    TypeRegistry.Clear()
  })

  test('functionInJSON should still be called when the body is Form', async () => {
    const form = new FormData()
    form.append('foo', 'foo')
    await app.request('/hello', {
      method: 'POST',
      body: form,
    })
    expect(functionInForm).toHaveBeenCalled()
    expect(functionInJSON).toHaveBeenCalled()
    functionInForm.mockReset()
    functionInJSON.mockReset()
  })
  test('functionInForm should still be called when the body is JSON', async () => {
    await app.request('/hello', {
      method: 'POST',
      body: JSON.stringify({ foo: 'foo' }),
      headers: {
        'content-type': 'application/json',
      },
    })
    expect(functionInForm).toHaveBeenCalled()
    expect(functionInJSON).toHaveBeenCalled()
    functionInForm.mockReset()
    functionInJSON.mockReset()
  })
})

describe('JSON and Text response', () => {
  const route = createRoute({
    method: 'get',
    path: '/hello',
    request: {},
    responses: {
      200: {
        content: {
          'application/json': {
            schema: T.Object({}),
          },
          'text/plain': {
            schema: T.String(),
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
      id: T.Number({ examples: [123] }),
      name: T.String({ examples: ['John Doe'] }),
      age: T.Number({ examples: [42] }),
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

  const app = new OpenAPIHono()

  app.openapi(route, (c) => {
    const { id } = c.req.valid('param')
    const { age } = c.req.valid('query')
    const { sex } = c.req.valid('json')

    return c.json({
      id: +id,
      age: +age,
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
  const RequestSchema = T.Object(
    {
      id: T.Number(),
    },
    {
      $id: 'Request',
    }
  )

  const PostSchema = T.Object(
    {
      id: T.Number(),
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
  it('Should include definitions from nested routers', async () => {
    const router = new OpenAPIHono().openapi(route, (ctx) => {
      return ctx.json({ id: 123 })
    })

    const app = new OpenAPIHono().route('/api', router)
    const json = app.getOpenAPIDocument({
      documentation: {
        openapi: '3.1.0',
        info: {
          title: 'My API',
          version: '1.0.0',
        },
      },
    })

    expect(json.components?.schemas).toHaveProperty('Request')
    expect(json.components?.schemas).toHaveProperty('Post')
    expect(json.paths).toHaveProperty('/api/posts')

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
  const ParamsSchema = T.Object({
    id: T.String(),
    tagName: T.String(),
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
    request: {},
    responses: {
      200: {
        description: 'Get message',
      },
    },
  })

  const app = new OpenAPIHono().basePath('/api')
  app.openapi(route, (c) => c.json({ message: 'Hello' }))
  app.doc('/doc', {
    documentation: {
      openapi: '3.1.0',
      info: {
        version: '1.0.0',
        title: 'My API',
      },
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
})

describe('With hc', () => {
  describe('Multiple routes', () => {
    const app = new OpenAPIHono()

    const createPostRoute = createRoute({
      method: 'post',
      path: '/posts',
      request: {},
      responses: {
        200: {
          description: 'A post',
        },
      },
      detail: {
        operationId: 'createPost',
      },
    })

    const createBookRoute = createRoute({
      method: 'post',
      path: '/books',
      request: {},
      responses: {
        200: {
          description: 'A book',
        },
      },
      detail: {
        operationId: 'createBook',
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

    const TitleSchema = T.Object({
      title: T.String(),
    })

    function errorResponse() {
      return {
        400: {
          content: {
            'application/json': {
              schema: T.Object({
                ok: T.Boolean(),
                source: T.Union([T.Literal('routeHook'), T.Literal('defaultHook')]),
              }),
            },
          },
          description: 'A validation error',
        },
      } satisfies OpenAPIRoute['responses']
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
      request: {},
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

describe('Path normaliTation', () => {
  const createRootApp = () => {
    const app = new OpenAPIHono()
    app.doc('/doc', {
      documentation: {
        openapi: '3.1.0',
        info: {
          version: '1.0.0',
          title: 'My API',
        },
      },
    })
    return app
  }

  const generateRoute = (path: string) => {
    return createRoute({
      path,
      method: 'get',
      request: {},
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
        openapi: '3.1.0',
        info: {
          version: '1.0.0',
          title: 'My API',
        },
        components: {
          schemas: {},
        },
        paths: {
          '/child': {
            get: {
              operationId: 'getChild',
              responses: {
                204: {
                  content: {},
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
        openapi: '3.1.0',
        info: {
          version: '1.0.0',
          title: 'My API',
        },
        components: {
          schemas: {},
        },
        paths: {
          '/api/granchild': {
            get: {
              operationId: 'getApiGranchild',
              responses: {
                204: {
                  content: {},
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
        openapi: '3.1.0',
        info: {
          version: '1.0.0',
          title: 'My API',
        },
        components: {
          schemas: {},
        },
        paths: {
          '/api': {
            get: {
              operationId: 'getApi',
              responses: {
                204: {
                  content: {},
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
      request: {},
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
    documentation: {
      openapi: '3.1.0',
      info: {
        version: '1.0.0',
        title: context.env.TITLE,
      },
    },
  }))

  it('Should return with the title set as specified in env', async () => {
    const res = await app.request('/doc', undefined, { TITLE: 'My API' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      openapi: '3.1.0',
      info: {
        version: '1.0.0',
        title: 'My API',
      },
      components: {
        schemas: {},
      },
      paths: {
        '/no-content': {
          get: {
            operationId: 'getNo-content',
            responses: {
              204: {
                content: {},
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
    documentation: {
      openapi: '3.1.0',
      info: {
        version: '1.0.0',
        title: 'my API',
      },
    },
  }))

  const sub = new OpenAPIHono()
  sub.openapi(
    createRoute({
      method: 'get',
      path: '/sub/{subId}',
      request: {},
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
    const data = await res.json()
    expect(Object.keys(data.paths)[0]).toBe('/root/{rootId}/sub/{subId}')
  })
})

// describe('Handle "Conflicting names for parameter"', () => {
//   const app = new OpenAPIHono()
//   app.openapi(
//     createRoute({
//       method: 'get',
//       path: '/posts/{foo}', // should be `id`
//       request: {
//         params: T.Object({
//           id: T.String(),
//         }),
//       },
//       responses: {
//         200: {
//           description: 'response',
//         },
//       },
//     }),
//     (c) => c.text('foo')
//   )

//   app.doc('/doc', () => ({
//     documentation: {
//       openapi: '3.1.0',
//       info: {
//         version: '1.0.0',
//         title: 'my API',
//       },
//     },
//   }))

//   it('Should return a 500 response correctly - /doc', async () => {
//     const res = await app.request('/doc')
//     expect(res.status).toBe(500)
//     const data = await res.json()
//     expect(data).toEqual({
//       data: {
//         key: 'name',
//         values: ['id', 'foo'],
//       },
//       message: 'Conflicting names for parameter',
//     })
//   })
// })

describe('Middleware', () => {
  const app = new OpenAPIHono()
  const route = createRoute({
    method: 'get',
    path: '/books',
    request: {},
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
  })
  app.openapi(route, (c) => c.text('foo'))

  it('Should have the header set by the middleware', async () => {
    const res = await app.request('/books')
    expect(res.status).toBe(200)
    expect(res.headers.get('x-foo')).toBe('bar')
  })
})

describe('RouteConfigToTypedResponse', () => {
  const ParamsSchema = T.Object({
    id: T.String({ minLength: 4, examples: ['1234'] }),
  })
  const UserSchema = T.Object(
    {
      name: T.String({ examples: ['John Doe'] }),
      age: T.Number({ examples: [42] }),
    },
    { $id: 'User' }
  )

  const ErrorSchema = T.Object(
    {
      ok: T.Boolean({ examples: [false] }),
    },
    { $id: 'Error' }
  )

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
        500: {
          content: {
            'application/json': {
              schema: ErrorSchema,
            },
          },
          description: 'Server Error!',
        },
      },
    } satisfies OpenAPIRoute

    type Actual = RouteConfigToTypedResponse<typeof route>

    type Expected =
      | TypedResponse<
          {
            name: string
            age: number
          },
          200,
          'json' | 'text'
        >
      | TypedResponse<
          {
            ok: boolean
          },
          400,
          'json' | 'text'
        >
      | TypedResponse<
          {
            ok: boolean
          },
          500,
          'json' | 'text'
        >
    type verify = Expect<Equal<Expected, Actual>>
  })
})

describe('Generate YAML', () => {
  it('Should generate YAML with Middleware', async () => {
    const app = new OpenAPIHono()
    app.openapi(
      createRoute({
        method: 'get',
        path: '/books',
        request: {},
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
                schema: T.Array(
                  T.Object({
                    title: T.String(),
                  })
                ),
              },
            },
          },
        },
      }),
      (c) => c.json([{ title: 'foo' }])
    )
    const doc = app.getOpenAPIDocument({
      documentation: {
        openapi: '3.1.0',
        info: {
          title: 'My API',
          version: '1.0.0',
        },
      },
    })
    expect(() => stringify(doc)).to.not.throw()
  })
})
