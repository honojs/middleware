import { describe, expect, it } from 'vitest'

import { OpenAPIRegistry, generateComponents, generateDocument } from './index'
import * as v from './index'

const config = { openapi: '3.0.0', info: { title: 'API', version: '1.0.0' } } as const

describe('registry', () => {
  it('registers parameters with the refId as the default name and keeps explicit names', () => {
    const registry = OpenAPIRegistry()
    registry.registerParameter('Id', v.pipe(v.string(), v.openapi({ param: { in: 'path' } })))
    registry.registerParameter(
      'Q',
      v.pipe(v.string(), v.openapi({ param: { in: 'query', name: 'q' } }))
    )
    const result = generateComponents(registry.definitions, { openapi: '3.0.0' })
    expect(result.ok ? result.value.components : result).toStrictEqual({
      schemas: { Id: { type: 'string' }, Q: { type: 'string' } },
      parameters: {
        Id: {
          schema: { $ref: '#/components/schemas/Id' },
          required: true,
          in: 'path',
          name: 'Id',
        },
        Q: { schema: { $ref: '#/components/schemas/Q' }, required: true, in: 'query', name: 'q' },
      },
    })
  })

  it('registers raw components, merges them with generated ones and sorts on request', () => {
    const parent = OpenAPIRegistry()
    parent.register('B', v.string())
    const registry = OpenAPIRegistry([parent])
    registry.register('A', v.number())
    registry.registerComponent('schemas', 'Raw', { type: 'string' })
    registry.registerComponent('parameters', 'RawParam', { name: 'raw', in: 'query' })
    const bearer = registry.registerComponent('securitySchemes', 'bearerAuth', {
      type: 'http',
      scheme: 'bearer',
    })
    expect(bearer).toStrictEqual({
      name: 'bearerAuth',
      ref: { $ref: '#/components/securitySchemes/bearerAuth' },
    })
    const result = generateDocument(registry.definitions, config, {
      sortComponents: 'alphabetically',
    })
    expect(result.ok ? result.value.components : result).toStrictEqual({
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } },
      schemas: { A: { type: 'number' }, B: { type: 'string' }, Raw: { type: 'string' } },
      parameters: { RawParam: { name: 'raw', in: 'query' } },
    })
  })

  it('keeps registered schemas usable for parsing', () => {
    const User = OpenAPIRegistry().register('User', v.object({ name: v.string() }))
    expect(v.parse(User, { name: 'a' })).toStrictEqual({ name: 'a' })
  })
})

describe('parameters', () => {
  it('generates path, query, header and cookie parameters with metadata', () => {
    const Limit = OpenAPIRegistry().registerParameter(
      'Limit',
      v.pipe(v.optional(v.number()), v.openapi({ param: { name: 'limit', in: 'query' } }))
    )
    const document = generateDocument(
      [
        { type: 'parameter', schema: Limit },
        {
          type: 'route',
          route: {
            method: 'get',
            path: '/users/{id}',
            parameters: [{ name: 'manual', in: 'query', schema: { type: 'string' } }],
            request: {
              params: v.object({ id: v.string() }),
              query: v.object({
                limit: Limit,
                q: v.pipe(
                  v.string(),
                  v.openapi({ description: 'Schema', param: { description: 'Param' } })
                ),
              }),
              headers: [v.pipe(v.string(), v.openapi({ param: { name: 'x-a' } }))],
              cookies: v.object({ session: v.nullable(v.string()) }),
            },
            responses: { 200: { description: 'OK' } },
          },
        },
      ],
      config
    )
    expect(document.ok ? document.value.components?.parameters : document).toStrictEqual({
      Limit: {
        schema: { $ref: '#/components/schemas/Limit' },
        required: false,
        name: 'limit',
        in: 'query',
      },
    })
    expect(
      document.ok ? document.value.paths?.['/users/{id}']?.get?.parameters : document
    ).toStrictEqual([
      { name: 'manual', in: 'query', schema: { type: 'string' } },
      { schema: { type: 'string' }, required: true, name: 'id', in: 'path' },
      { $ref: '#/components/parameters/Limit' },
      {
        schema: { type: 'string', description: 'Schema' },
        required: true,
        description: 'Param',
        name: 'q',
        in: 'query',
      },
      { schema: { type: 'string' }, required: true, name: 'x-a', in: 'header' },
      {
        schema: { type: 'string', nullable: true },
        required: false,
        name: 'session',
        in: 'cookie',
      },
    ])
  })

  it('reports missing names and conflicting names / locations as error results', () => {
    const route = (query: v.GenericSchema) =>
      generateDocument(
        [{ type: 'route', route: { method: 'get', path: '/', request: { query }, responses: {} } }],
        config
      )
    expect(route(v.string())).toStrictEqual({
      ok: false,
      error: {
        type: 'MissingParameterDataError',
        message:
          'Missing parameter data, please specify `name` and other OpenAPI parameter props using the `param` field of `openapi()`',
        data: { missingField: 'name', location: 'query', route: 'get /' },
      },
    })
    expect(
      route(v.object({ id: v.pipe(v.string(), v.openapi({ param: { name: 'x' } })) }))
    ).toStrictEqual({
      ok: false,
      error: {
        type: 'ConflictError',
        message:
          'Conflicting names for parameter. Use the same key in the route object and in `openapi({ param: { name } })`',
        data: { key: 'name', values: ['id', 'x'] },
      },
    })
    expect(
      route(v.object({ id: v.pipe(v.string(), v.openapi({ param: { in: 'path' } })) }))
    ).toStrictEqual({
      ok: false,
      error: {
        type: 'ConflictError',
        message:
          'Conflicting location for parameter id. Use the same `in` in the route request and in `openapi({ param: { in } })`',
        data: { key: 'in', values: ['query', 'path'] },
      },
    })
    expect(
      route(v.pipe(v.string(), v.openapi({ param: { name: 'q', in: 'path' } })))
    ).toStrictEqual({
      ok: false,
      error: {
        type: 'ConflictError',
        message:
          'Conflicting location for parameter q. Use the same `in` in the route request and in `openapi({ param: { in } })`',
        data: { key: 'in', values: ['query', 'path'] },
      },
    })
    const registry = OpenAPIRegistry()
    const P = registry.registerParameter(
      'P',
      v.pipe(v.string(), v.openapi({ param: { name: 'p', in: 'path' } }))
    )
    registry.registerPath({ method: 'get', path: '/', request: { query: P }, responses: {} })
    expect(generateDocument(registry.definitions, config)).toStrictEqual({
      ok: false,
      error: {
        type: 'ConflictError',
        message:
          'Conflicting location for parameter p. Use the same `in` in the route request and in `openapi({ param: { in } })`',
        data: { key: 'in', values: ['path', 'query', 'path'] },
      },
    })
  })
})

describe('routes', () => {
  it('generates request bodies, responses, headers, raw content and webhooks', () => {
    const registry = OpenAPIRegistry()
    const User = registry.register('User', v.object({ name: v.string() }))
    registry.registerPath({
      method: 'post',
      path: '/users',
      summary: 'Create',
      request: { body: { required: true, content: { 'application/json': { schema: User } } } },
      responses: {
        201: {
          description: 'Created',
          headers: v.object({
            'x-id': v.string(),
            'x-opt': v.optional(v.string()),
          }),
          content: { 'application/json': { schema: User, example: { name: 'a' } } },
        },
        400: { description: 'Bad', headers: { 'x-raw': { schema: { type: 'string' } } } },
        404: { $ref: '#/components/responses/NotFound' },
        default: {
          description: 'Raw',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/Raw' } },
            'text/plain': { $ref: '#/components/mediaTypes/Plain' },
          },
        },
      },
    })
    registry.registerPath({
      method: 'get',
      path: '/users',
      responses: { 200: { description: 'List' } },
    })
    registry.registerWebhook({
      method: 'post',
      path: 'userCreated',
      request: { body: { content: { 'application/json': { schema: User } } } },
      responses: { 200: { description: 'OK' } },
    })
    const v30 = generateDocument(registry.definitions, config)
    expect(v30.ok && 'webhooks' in v30.value).toBe(false)
    expect(v30.ok ? v30.value.paths : v30).toStrictEqual({
      '/users': {
        post: {
          summary: 'Create',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } },
          },
          responses: {
            201: {
              description: 'Created',
              headers: {
                'x-id': { schema: { type: 'string' }, required: true },
                'x-opt': { schema: { type: 'string' }, required: false },
              },
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/User' },
                  example: { name: 'a' },
                },
              },
            },
            400: { description: 'Bad', headers: { 'x-raw': { schema: { type: 'string' } } } },
            404: { $ref: '#/components/responses/NotFound' },
            default: {
              description: 'Raw',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/Raw' } },
                'text/plain': { $ref: '#/components/mediaTypes/Plain' },
              },
            },
          },
        },
        get: { responses: { 200: { description: 'List' } } },
      },
    })
    const v32 = generateDocument(registry.definitions, { ...config, openapi: '3.2.0' })
    expect(v32.ok ? v32.value.webhooks : v32).toStrictEqual({
      userCreated: {
        post: {
          requestBody: {
            content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } },
          },
          responses: { 200: { description: 'OK' } },
        },
      },
    })
  })

  it('supports the 3.2 query method, itemSchema and encodings', () => {
    const Item = v.pipe(v.object({ id: v.string() }), v.openapi('Item'))
    const document = generateDocument(
      [
        {
          type: 'route',
          route: {
            method: 'query',
            path: '/search',
            responses: {
              200: {
                summary: 'Stream',
                content: {
                  'application/jsonl': {
                    itemSchema: Item,
                    itemEncoding: { contentType: 'application/json' },
                  },
                  'application/json': {
                    schema: v.tuple([v.string(), v.number()]),
                    prefixEncoding: [{ contentType: 'text/plain' }],
                  },
                },
              },
            },
          },
        },
      ],
      { ...config, openapi: '3.2.0' }
    )
    expect(
      document.ok ? document.value.paths?.['/search']?.query?.responses?.[200] : document
    ).toStrictEqual({
      summary: 'Stream',
      content: {
        'application/jsonl': {
          itemSchema: { $ref: '#/components/schemas/Item' },
          itemEncoding: { contentType: 'application/json' },
        },
        'application/json': {
          schema: { type: 'array', prefixItems: [{ type: 'string' }, { type: 'number' }] },
          prefixEncoding: [{ contentType: 'text/plain' }],
        },
      },
    })
  })

  it('adds metadata overrides to references and keeps registered schemas referenced', () => {
    const Base = v.pipe(v.string(), v.openapi('Base', { description: 'base' }))
    const overrides = generateComponents(
      [
        Base,
        v.pipe(
          v.object({
            same: v.pipe(Base, v.openapi({ description: 'base' })),
            more: v.pipe(Base, v.openapi({ description: 'more', example: 'x' })),
            typed: v.pipe(Base, v.openapi({ type: 'integer' })),
            withDefault: v.optional(Base, 'd'),
          }),
          v.openapi('T')
        ),
      ],
      { openapi: '3.0.0' }
    )
    expect(overrides.ok ? overrides.value.components?.schemas?.T : overrides).toStrictEqual({
      type: 'object',
      properties: {
        same: { $ref: '#/components/schemas/Base' },
        more: {
          allOf: [{ $ref: '#/components/schemas/Base' }, { description: 'more', example: 'x' }],
        },
        typed: { allOf: [{ $ref: '#/components/schemas/Base' }, { type: 'integer' }] },
        withDefault: { allOf: [{ $ref: '#/components/schemas/Base' }, { default: 'd' }] },
      },
      required: ['same', 'more', 'typed'],
    })
  })
})
