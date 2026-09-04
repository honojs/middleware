import { toStandardJsonSchema } from '@valibot/to-json-schema'
import { type } from 'arktype'
import * as v from 'valibot'
import { z } from 'zod'
import * as zm from 'zod/mini'
import { OpenAPIHono, createRoute } from './index'

const info = { title: 'API', version: '1.0.0' }
const config = { openapi: '3.0.0', info }
const config31 = { openapi: '3.1.0', info }

describe('ArkType schemas', () => {
  const app = new OpenAPIHono()

  app.openapi(
    createRoute({
      method: 'post',
      path: '/users/{id}',
      summary: 'Update a user',
      request: {
        params: type({ id: 'string' }),
        query: type({ 'dryRun?': 'string' }),
        body: {
          required: true,
          content: {
            'application/json': { schema: type({ name: 'string', age: 'number' }) },
          },
        },
      },
      responses: {
        200: {
          description: 'Updated',
          content: { 'application/json': { schema: type({ id: 'string' }) } },
        },
      },
    }),
    (c) => {
      const { name } = c.req.valid('json')
      const { id } = c.req.valid('param')
      return c.json({ id: `${id}:${name}` }, 200)
    }
  )

  it('describes an ArkType body and response in the document', () => {
    expect(app.getOpenAPIDocument(config)).toMatchObject({
      paths: {
        '/users/{id}': {
          post: {
            summary: 'Update a user',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { name: { type: 'string' }, age: { type: 'number' } },
                    // ArkType sorts `required` alphabetically — assert the set, not its order.
                    required: expect.arrayContaining(['name', 'age']) as unknown as string[],
                  },
                },
              },
            },
            responses: {
              200: {
                description: 'Updated',
                content: {
                  'application/json': {
                    schema: { type: 'object', properties: { id: { type: 'string' } } },
                  },
                },
              },
            },
          },
        },
      },
    })
  })

  it('splits an ArkType object into individual parameters, preserving optionality', () => {
    expect(app.getOpenAPIDocument(config)).toMatchObject({
      paths: {
        '/users/{id}': {
          post: {
            parameters: [
              { in: 'path', name: 'id', required: true, schema: { type: 'string' } },
              { in: 'query', name: 'dryRun', required: false, schema: { type: 'string' } },
            ],
          },
        },
      },
    })
  })

  it('validates requests against an ArkType schema', async () => {
    const res = await app.request('/users/abc', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Ada', age: 36 }),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 'abc:Ada' })
  })

  it('rejects requests that do not match an ArkType schema', async () => {
    const res = await app.request('/users/abc', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Ada', age: 'not a number' }),
    })

    expect(res.status).toBe(400)
  })

  it('generates a 3.1 document without leaking $schema into it', () => {
    const doc = app.getOpenAPI31Document(config31)

    expect(doc.openapi).toBe('3.1.0')
    expect(doc).toMatchObject({
      paths: {
        '/users/{id}': {
          post: {
            requestBody: { content: { 'application/json': { schema: { type: 'object' } } } },
          },
        },
      },
    })
    expect(doc).not.toHaveProperty([
      'paths',
      '/users/{id}',
      'post',
      'requestBody',
      'content',
      'application/json',
      'schema',
      '$schema',
    ])
  })
})

describe('Valibot schemas', () => {
  // Valibot keeps `~standard.jsonSchema` out of the core bundle; `toStandardJsonSchema()`
  // adds it and leaves `validate` alone, so the wrapped schema still validates.
  const app = new OpenAPIHono()

  app.openapi(
    createRoute({
      method: 'post',
      path: '/valibot/{id}',
      summary: 'Update a user',
      request: {
        params: toStandardJsonSchema(v.object({ id: v.string() })),
        query: toStandardJsonSchema(v.object({ dryRun: v.optional(v.string()) })),
        body: {
          required: true,
          content: {
            'application/json': {
              schema: toStandardJsonSchema(v.object({ name: v.string(), age: v.number() })),
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Updated',
          content: {
            'application/json': { schema: toStandardJsonSchema(v.object({ id: v.string() })) },
          },
        },
      },
    }),
    (c) => {
      const { name } = c.req.valid('json')
      const { id } = c.req.valid('param')
      return c.json({ id: `${id}:${name}` }, 200)
    }
  )

  it('describes a Valibot body, response and parameters in the document', () => {
    expect(app.getOpenAPIDocument(config)).toMatchObject({
      paths: {
        '/valibot/{id}': {
          post: {
            summary: 'Update a user',
            parameters: [
              { in: 'path', name: 'id', required: true, schema: { type: 'string' } },
              { in: 'query', name: 'dryRun', required: false, schema: { type: 'string' } },
            ],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { name: { type: 'string' }, age: { type: 'number' } },
                    required: ['name', 'age'],
                  },
                },
              },
            },
            responses: {
              200: {
                description: 'Updated',
                content: {
                  'application/json': {
                    schema: { type: 'object', properties: { id: { type: 'string' } } },
                  },
                },
              },
            },
          },
        },
      },
    })
  })

  it('validates requests against a Valibot schema', async () => {
    const res = await app.request('/valibot/abc', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Ada', age: 36 }),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 'abc:Ada' })
  })

  it('rejects requests that do not match a Valibot schema', async () => {
    const res = await app.request('/valibot/abc', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Ada', age: 'not a number' }),
    })

    expect(res.status).toBe(400)
  })

  it('generates a 3.1 document without leaking $schema into it', () => {
    const doc = app.getOpenAPI31Document(config31)

    expect(doc).toMatchObject({
      paths: {
        '/valibot/{id}': {
          post: {
            requestBody: { content: { 'application/json': { schema: { type: 'object' } } } },
          },
        },
      },
    })
    expect(doc).not.toHaveProperty([
      'paths',
      '/valibot/{id}',
      'post',
      'requestBody',
      'content',
      'application/json',
      'schema',
      '$schema',
    ])
  })
})

describe('mixing schema libraries', () => {
  it('accepts Zod, Valibot and ArkType schemas on the same route', async () => {
    const app = new OpenAPIHono()

    app.openapi(
      createRoute({
        method: 'post',
        path: '/three/{id}',
        request: {
          params: toStandardJsonSchema(v.object({ id: v.string() })),
          query: z.object({ tag: z.string() }),
          body: {
            required: true,
            content: { 'application/json': { schema: type({ name: 'string' }) } },
          },
        },
        responses: {
          200: {
            description: 'ok',
            content: { 'application/json': { schema: z.object({ id: z.string() }) } },
          },
        },
      }),
      (c) => {
        const { id } = c.req.valid('param')
        const { tag } = c.req.valid('query')
        const { name } = c.req.valid('json')
        return c.json({ id: `${id}:${tag}:${name}` }, 200)
      }
    )

    const res = await app.request('/three/abc?tag=x', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Ada' }),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 'abc:x:Ada' })

    expect(app.getOpenAPIDocument(config)).toMatchObject({
      paths: {
        '/three/{id}': {
          post: {
            parameters: [
              { in: 'path', name: 'id', required: true, schema: { type: 'string' } },
              { in: 'query', name: 'tag', required: true, schema: { type: 'string' } },
            ],
            requestBody: {
              content: {
                'application/json': {
                  schema: { type: 'object', properties: { name: { type: 'string' } } },
                },
              },
            },
          },
        },
      },
    })
  })

  it('accepts Zod and ArkType schemas on the same route', () => {
    const app = new OpenAPIHono()

    app.openapi(
      createRoute({
        method: 'post',
        path: '/mixed',
        request: {
          body: {
            required: true,
            content: { 'application/json': { schema: type({ name: 'string' }) } },
          },
        },
        responses: {
          200: {
            description: 'ok',
            content: { 'application/json': { schema: z.object({ id: z.string() }) } },
          },
        },
      }),
      (c) => c.json({ id: c.req.valid('json').name }, 200)
    )

    expect(app.getOpenAPIDocument(config)).toMatchObject({
      paths: {
        '/mixed': {
          post: {
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { name: { type: 'string' } },
                    required: ['name'],
                  },
                },
              },
            },
            responses: {
              200: {
                content: {
                  'application/json': {
                    schema: { type: 'object', properties: { id: { type: 'string' } } },
                  },
                },
              },
            },
          },
        },
      },
    })
  })

  it('treats Zod like every other library, with no Zod-specific code path', async () => {
    const app = new OpenAPIHono()

    app.openapi(
      createRoute({
        method: 'post',
        path: '/zod',
        request: {
          body: {
            required: true,
            content: { 'application/json': { schema: z.object({ name: z.string() }) } },
          },
        },
        responses: {
          200: {
            description: 'ok',
            content: { 'application/json': { schema: z.object({ id: z.string() }) } },
          },
        },
      }),
      (c) => c.json({ id: c.req.valid('json').name }, 200)
    )

    const res = await app.request('/zod', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Ada' }),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 'Ada' })

    expect(app.getOpenAPIDocument(config)).toMatchObject({
      paths: {
        '/zod': {
          post: {
            requestBody: {
              content: {
                'application/json': {
                  schema: { type: 'object', properties: { name: { type: 'string' } } },
                },
              },
            },
          },
        },
      },
    })
  })
})

describe('libraries without a native JSON Schema interface', () => {
  // Zod Mini ships `~standard.validate` but not `~standard.jsonSchema`. This mirrors the
  // wrapper the README documents — keep the two in step.
  const withJSONSchema = <T extends zm.core.$ZodType>(schema: T) =>
    Object.assign(schema, {
      '~standard': {
        ...schema['~standard'],
        jsonSchema: {
          input: (options?: { target?: string }) =>
            zm.toJSONSchema(schema, { io: 'input', target: options?.target as never }),
          output: (options?: { target?: string }) =>
            zm.toJSONSchema(schema, { io: 'output', target: options?.target as never }),
        },
      },
    })

  it('documents and validates a wrapped Zod Mini schema', async () => {
    const app = new OpenAPIHono()
    const Body = withJSONSchema(zm.object({ name: zm.string() }))

    app.openapi(
      createRoute({
        method: 'post',
        path: '/mini',
        request: { body: { required: true, content: { 'application/json': { schema: Body } } } },
        responses: { 200: { description: 'ok' } },
      }),
      (c) => c.json({ name: c.req.valid('json').name }, 200)
    )

    expect(app.getOpenAPI31Document(config31)).toMatchObject({
      paths: {
        '/mini': {
          post: {
            requestBody: {
              content: {
                'application/json': {
                  schema: { type: 'object', properties: { name: { type: 'string' } } },
                },
              },
            },
          },
        },
      },
    })

    const ok = await app.request('/mini', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Ada' }),
    })
    expect(ok.status).toBe(200)

    const bad = await app.request('/mini', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 42 }),
    })
    expect(bad.status).toBe(400)
  })
})

describe('named components', () => {
  it('emits a $ref for a schema registered by name, from any library', () => {
    const app = new OpenAPIHono()
    const User = app.openAPIRegistry.register('User', type({ id: 'string' }))

    app.openapi(
      createRoute({
        method: 'get',
        path: '/users',
        responses: {
          200: { description: 'ok', content: { 'application/json': { schema: User } } },
        },
      }),
      (c) => c.json({ id: '1' }, 200)
    )

    expect(app.getOpenAPIDocument(config)).toMatchObject({
      paths: {
        '/users': {
          get: {
            responses: {
              200: {
                content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } },
              },
            },
          },
        },
      },
      components: { schemas: { User: { type: 'object' } } },
    })
  })

  it('splits a named schema whose input and output differ into two components', () => {
    const app = new OpenAPIHono()
    const Post = app.openAPIRegistry.register(
      'Post',
      z.object({ title: z.string(), draft: z.boolean().default(true) })
    )

    app.openapi(
      createRoute({
        method: 'post',
        path: '/posts',
        request: { body: { required: true, content: { 'application/json': { schema: Post } } } },
        responses: {
          200: { description: 'ok', content: { 'application/json': { schema: Post } } },
        },
      }),
      (c) => c.json(c.req.valid('json'), 200)
    )

    // `draft` has a default: optional on the way in, guaranteed on the way out.
    expect(app.getOpenAPI31Document(config31)).toMatchObject({
      paths: {
        '/posts': {
          post: {
            requestBody: {
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/PostInput' } },
              },
            },
            responses: {
              200: {
                content: { 'application/json': { schema: { $ref: '#/components/schemas/Post' } } },
              },
            },
          },
        },
      },
      components: {
        schemas: {
          PostInput: { required: ['title'] },
          Post: { required: ['title', 'draft'] },
        },
      },
    })
  })

  it('registers a hand-written component and refs it', () => {
    const app = new OpenAPIHono()
    const { ref } = app.openAPIRegistry.registerComponent('securitySchemes', 'bearer', {
      type: 'http',
      scheme: 'bearer',
    })

    expect(ref).toEqual({ $ref: '#/components/securitySchemes/bearer' })
    expect(app.getOpenAPIDocument(config)).toMatchObject({
      components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } } },
    })
  })
})

describe('input and output types', () => {
  it('describes the request body with the input type and the response with the output type', () => {
    const app = new OpenAPIHono()
    // `role` has a default, so it is optional coming in and guaranteed going out — the
    // request body and the response should not describe it the same way.
    const schema = type({ name: 'string', role: 'string = "user"' })

    app.openapi(
      createRoute({
        method: 'post',
        path: '/echo',
        request: {
          body: { required: true, content: { 'application/json': { schema } } },
        },
        responses: {
          200: { description: 'ok', content: { 'application/json': { schema } } },
        },
      }),
      (c) => c.json(c.req.valid('json'), 200)
    )

    expect(app.getOpenAPI31Document(config31)).toMatchObject({
      paths: {
        '/echo': {
          post: {
            requestBody: {
              content: { 'application/json': { schema: { required: ['name'] } } },
            },
            responses: {
              200: {
                content: { 'application/json': { schema: { required: ['name', 'role'] } } },
              },
            },
          },
        },
      },
    })
  })
})

describe('target support', () => {
  it('falls back to draft-07 for a 3.0 document when a library rejects openapi-3.0', () => {
    // ArkType implements only the drafts — `doc()` would be unusable for it without the
    // `draft-07` fallback, so pin the throw that makes the fallback necessary.
    expect(() =>
      type({ name: 'string' })['~standard'].jsonSchema.input({ target: 'openapi-3.0' })
    ).toThrow()

    const app = new OpenAPIHono()
    app.openapi(
      createRoute({
        method: 'get',
        path: '/ark',
        request: { query: type({ name: 'string' }) },
        responses: { 200: { description: 'ok' } },
      }),
      (c) => c.json({}, 200)
    )

    expect(app.getOpenAPIDocument(config)).toMatchObject({
      paths: {
        '/ark': {
          get: {
            parameters: [{ in: 'query', name: 'name', required: true, schema: { type: 'string' } }],
          },
        },
      },
    })
  })

  it('lets the user pick which JSON Schema dialect to request', () => {
    const app = new OpenAPIHono({
      // ArkType rejects openapi-3.0 — ask for draft-07 only, no silent fallback chain.
      jsonSchemaTargets: { '3.0': ['draft-07'] },
    })
    app.openapi(
      createRoute({
        method: 'get',
        path: '/ark',
        request: { query: type({ name: 'string' }) },
        responses: { 200: { description: 'ok' } },
      }),
      (c) => c.json({}, 200)
    )

    expect(app.getOpenAPIDocument(config)).toMatchObject({
      paths: {
        '/ark': {
          get: {
            parameters: [{ in: 'query', name: 'name', required: true, schema: { type: 'string' } }],
          },
        },
      },
    })
  })

  it('accepts a per-document override of the JSON Schema dialect', () => {
    const app = new OpenAPIHono()
    app.openapi(
      createRoute({
        method: 'get',
        path: '/ark',
        request: { query: type({ name: 'string' }) },
        responses: { 200: { description: 'ok' } },
      }),
      (c) => c.json({}, 200)
    )

    expect(app.getOpenAPIDocument(config, { jsonSchemaTargets: ['draft-07'] })).toMatchObject({
      paths: {
        '/ark': {
          get: {
            parameters: [{ in: 'query', name: 'name', required: true, schema: { type: 'string' } }],
          },
        },
      },
    })
  })

  it('names the vendor when no target is supported', () => {
    const broken = {
      '~standard': {
        version: 1 as const,
        vendor: 'broken-lib',
        validate: (value: unknown) => ({ value }),
        jsonSchema: {
          input: () => {
            throw new Error('unsupported target')
          },
          output: () => {
            throw new Error('unsupported target')
          },
        },
      },
    }

    const app = new OpenAPIHono()
    app.openapi(
      createRoute({
        method: 'get',
        path: '/broken',
        request: { query: broken },
        responses: { 200: { description: 'ok' } },
      }),
      (c) => c.json({}, 200)
    )

    expect(() => app.getOpenAPIDocument(config)).toThrow(/"broken-lib" could not convert a schema/)
  })
})

describe('validation hooks', () => {
  it('hands the hook Standard Schema issues, whichever library failed', async () => {
    const issues: string[] = []
    const app = new OpenAPIHono({
      defaultHook: (result, c) => {
        if (!result.success) {
          issues.push(...result.error.map((issue) => issue.message))
          return c.json({ ok: false }, 400)
        }
      },
    })

    app.openapi(
      createRoute({
        method: 'post',
        path: '/hooked',
        request: {
          body: {
            required: true,
            content: { 'application/json': { schema: type({ age: 'number' }) } },
          },
        },
        responses: { 200: { description: 'ok' } },
      }),
      (c) => c.json({}, 200)
    )

    const res = await app.request('/hooked', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ age: 'nope' }),
    })

    expect(res.status).toBe(400)
    expect(issues.length).toBeGreaterThan(0)
  })
})

describe('response headers', () => {
  it('describes response headers instead of leaking library internals', () => {
    const app = new OpenAPIHono()
    app.openapi(
      createRoute({
        method: 'get',
        path: '/rh',
        responses: {
          200: { description: 'ok', headers: type({ 'x-total': 'string' }) },
        },
      }),
      (c) => c.json({}, 200)
    )

    expect(app.getOpenAPIDocument(config)).toMatchObject({
      paths: {
        '/rh': {
          get: {
            responses: {
              200: { headers: { 'x-total': { schema: { type: 'string' }, required: true } } },
            },
          },
        },
      },
    })
  })
})

describe('request headers', () => {
  const app = new OpenAPIHono()
  app.openapi(
    createRoute({
      method: 'get',
      path: '/qh',
      request: {
        headers: [type({ 'x-key': 'string' }), z.object({ 'x-trace': z.string() })],
      },
      responses: { 200: { description: 'ok' } },
    }),
    (c) => c.json({}, 200)
  )

  it('documents every schema in an array of header schemas', () => {
    expect(app.getOpenAPIDocument(config)).toMatchObject({
      paths: {
        '/qh': {
          get: {
            parameters: [
              { in: 'header', name: 'x-key', required: true, schema: { type: 'string' } },
              { in: 'header', name: 'x-trace', required: true, schema: { type: 'string' } },
            ],
          },
        },
      },
    })
  })

  it('validates against every schema in the array', async () => {
    expect((await app.request('/qh', { headers: { 'x-key': 'k', 'x-trace': 't' } })).status).toBe(
      200
    )
    // Each schema runs, so a header missing from either one is rejected.
    expect((await app.request('/qh', { headers: { 'x-key': 'k' } })).status).toBe(400)
    expect((await app.request('/qh', { headers: { 'x-trace': 't' } })).status).toBe(400)
  })
})

describe('sub apps', () => {
  it('merges routes from a mounted app', () => {
    const books = new OpenAPIHono()
    books.openapi(
      createRoute({
        method: 'get',
        path: '/{id}',
        request: { params: type({ id: 'string' }) },
        responses: { 200: { description: 'ok' } },
      }),
      (c) => c.json({}, 200)
    )

    const app = new OpenAPIHono().route('/books', books)

    expect(Object.keys(app.getOpenAPIDocument(config).paths)).toEqual(['/books/{id}'])
  })

  it('carries a mounted app’s named components up to the parent', () => {
    const books = new OpenAPIHono()
    const Book = books.openAPIRegistry.register('Book', type({ title: 'string' }))
    books.openapi(
      createRoute({
        method: 'get',
        path: '/',
        responses: {
          200: { description: 'ok', content: { 'application/json': { schema: Book } } },
        },
      }),
      (c) => c.json({ title: 'x' }, 200)
    )

    const app = new OpenAPIHono().route('/books', books)

    expect(app.getOpenAPIDocument(config)).toMatchObject({
      components: { schemas: { Book: { type: 'object' } } },
    })
  })
})
