/* eslint-disable node/no-extraneous-import */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Env } from 'hono'
import type { Hono } from 'hono'
import { describe, it, expect, expectTypeOf } from 'vitest'
import type { Schema } from 'zod'
import { OpenAPIHono, createRoute, z } from '../src'

describe('Basic - params', () => {
  const ParamsSchema = z.object({
    id: z
      .string()
      .min(3)
      .openapi({
        param: {
          name: 'id',
          in: 'path',
        },
        example: '1212121',
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
    path: '/users/:id',
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
        id: Number(id),
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
    const res = await app.request('/users/1')
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
        '/users/:id': {
          get: {
            parameters: [
              {
                schema: { type: 'string', minLength: 3, example: '1212121' },
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

  const PostsSchema = z
    .object({
      title: z.string().openapi({}),
      content: z.string().openapi({}),
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
            schema: PostsSchema,
          },
        },
        description: 'Get the posts',
      },
    },
  })

  const app = new OpenAPIHono()

  app.openapi(route, (c) => {
    const { page } = c.req.valid('query')
    return c.jsonT({
      title: 'Good title',
      content: 'Good content',
      page: Number(page),
    })
  })

  it('Should return 200 response with correct contents', async () => {
    const res = await app.request('/books?page=123')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      title: 'Good title',
      content: 'Good content',
      page: 123,
    })
  })

  it('Should return 400 response with correct contents', async () => {
    const res = await app.request('/books')
    expect(res.status).toBe(400)
  })
})

describe('JSON', () => {
  const RequestSchema = z.object({
    id: z.number().openapi({}),
    title: z.string().openapi({}),
  })

  const PostsSchema = z
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
            schema: PostsSchema,
          },
        },
        description: 'Get the posts',
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

  const PostsSchema = z
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
            schema: PostsSchema,
          },
        },
        description: 'Post the post',
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

  const PostsSchema = z
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
            schema: PostsSchema,
          },
        },
        description: 'Post the post',
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
      Schema<{
        '/posts': {
          $post: {
            input: {
              json: {
                title: string
                id: number
              }
            }
            output: {
              id: number
              message: string
            }
          }
        }
      }>,
      '/'
    >
    expectTypeOf(appRoutes).toMatchTypeOf<H>
  })
})
