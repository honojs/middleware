import { type } from 'arktype'
import { OpenAPIHono, createRoute, z } from './index'

const info = { title: 'API', version: '1.0.0' }
const config = { openapi: '3.0.0', info }
const config31 = { openapi: '3.1.0', info }

describe('non-Zod schemas', () => {
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

  it('validates requests against a non-Zod schema', async () => {
    const res = await app.request('/users/abc', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Ada', age: 36 }),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 'abc:Ada' })
  })

  it('rejects requests that do not match a non-Zod schema', async () => {
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

describe('mixing schema libraries', () => {
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

  it('keeps Zod-only apps on the existing registry path', () => {
    const app = new OpenAPIHono()
    const Schema = z.object({ id: z.string() }).openapi('User')

    app.openapi(
      createRoute({
        method: 'get',
        path: '/users',
        responses: {
          200: { description: 'ok', content: { 'application/json': { schema: Schema } } },
        },
      }),
      (c) => c.json({ id: '1' }, 200)
    )

    // A Zod-only app must not notice any of this: refs still resolve to components instead
    // of being inlined, which is what breaks if the route stops reaching the registry.
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

    expect(
      app.getOpenAPIDocument(config, undefined, { jsonSchemaTargets: ['draft-07'] })
    ).toMatchObject({
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

describe('response headers', () => {
  it('describes non-Zod response headers instead of leaking library internals', () => {
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

describe('sub apps', () => {
  it('merges non-Zod routes from a mounted app', () => {
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
})
