import { describe, expect, it } from 'vitest'

import { OpenAPIRegistry, generateDocument } from './index'
import * as v from './index'

const config = { openapi: '3.0.0', info: { title: 'API', version: '1.0.0' } } as const

describe('definition order', () => {
  it('generates schemas before the routes that reference them, whatever the registration order', () => {
    const U = v.pipe(v.object({ n: v.string() }), v.openapi('U'))
    const route = {
      method: 'get',
      path: '/u',
      responses: { 200: { description: 'OK', content: { 'application/json': { schema: U } } } },
    } as const
    const document = generateDocument(
      [
        { type: 'route', route },
        { type: 'schema', schema: U },
      ],
      config
    )
    expect(document.ok ? document.value.components?.schemas : document).toStrictEqual({
      U: { type: 'object', properties: { n: { type: 'string' } }, required: ['n'] },
    })
    expect(
      document.ok ? document.value.paths?.['/u']?.get?.responses?.[200] : document
    ).toStrictEqual({
      description: 'OK',
      content: { 'application/json': { schema: { $ref: '#/components/schemas/U' } } },
    })
  })
})

describe('parameters', () => {
  it('reports a registered parameter without a location, naming the parameter', () => {
    const schema = v.pipe(v.string(), v.openapi({ param: { name: 'q' } }))
    expect(generateDocument([{ type: 'parameter', schema }], config)).toStrictEqual({
      ok: false,
      error: {
        type: 'MissingParameterDataError',
        message:
          'Missing parameter data, please specify `in` and other OpenAPI parameter props using the `param` field of `openapi()`',
        data: { missingField: 'in', paramName: 'q' },
      },
    })
  })

  it('adds the location and route to a missing name in every parameter location', () => {
    const requests = [
      [{ params: v.string() }, 'path'],
      [{ cookies: v.string() }, 'cookie'],
      [{ headers: v.string() }, 'header'],
    ] as const
    for (const [request, location] of requests) {
      const route = { method: 'get', path: '/', request, responses: {} } as const
      const document = generateDocument([{ type: 'route', route }], config)
      expect(document.ok ? document : document.error).toStrictEqual({
        type: 'MissingParameterDataError',
        message:
          'Missing parameter data, please specify `name` and other OpenAPI parameter props using the `param` field of `openapi()`',
        data: { missingField: 'name', location, route: 'get /' },
      })
    }
  })

  it('reports a registered parameter used under a different key', () => {
    const registry = OpenAPIRegistry()
    const P = registry.registerParameter(
      'P',
      v.pipe(v.string(), v.openapi({ param: { name: 'p', in: 'query' } }))
    )
    registry.registerPath({
      method: 'get',
      path: '/',
      request: { query: v.object({ other: P }) },
      responses: {},
    })
    expect(generateDocument(registry.definitions, config)).toStrictEqual({
      ok: false,
      error: {
        type: 'ConflictError',
        message:
          'Conflicting names for parameter. Use the same key in the route object and in `openapi({ param: { name } })`',
        data: { key: 'name', values: ['p', 'other', 'p'] },
      },
    })
  })

  it('accepts request headers as a single object schema', () => {
    const registry = OpenAPIRegistry()
    registry.registerPath({
      method: 'get',
      path: '/h',
      request: { headers: v.object({ 'x-a': v.string(), 'x-b': v.optional(v.number()) }) },
      responses: {},
    })
    const document = generateDocument(registry.definitions, config)
    expect(document.ok ? document.value.paths?.['/h']?.get?.parameters : document).toStrictEqual([
      { schema: { type: 'string' }, required: true, name: 'x-a', in: 'header' },
      { schema: { type: 'number' }, required: false, name: 'x-b', in: 'header' },
    ])
  })
})

describe('document', () => {
  it('passes the top-level config through untouched', () => {
    const document = generateDocument([], {
      ...config,
      servers: [{ url: 'x' }],
      tags: [{ name: 't' }],
      security: [{ a: [] }],
      externalDocs: { url: 'u' },
    })
    expect(document).toStrictEqual({
      ok: true,
      value: {
        openapi: '3.0.0',
        info: { title: 'API', version: '1.0.0' },
        servers: [{ url: 'x' }],
        tags: [{ name: 't' }],
        security: [{ a: [] }],
        externalDocs: { url: 'u' },
        components: { schemas: {}, parameters: {} },
        paths: {},
      },
    })
  })
})
