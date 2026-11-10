import { describe, expect, it } from 'vitest'

import { OpenAPIRegistry, generateComponents, generateDocument } from './index'
import * as v from './index'

describe('smoke', () => {
  it('generates a component schema with nested refs, nullable and defaults', () => {
    const Id = v.pipe(v.string(), v.uuid(), v.openapi('Id', { description: 'The entity id' }))
    const User = v.pipe(
      v.object({
        id: Id,
        name: v.pipe(v.string(), v.minLength(1), v.maxLength(10)),
        age: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0)), 18),
        nickname: v.nullable(v.string()),
        tags: v.pipe(v.array(v.string()), v.nonEmpty()),
        role: v.picklist(['admin', 'user']),
      }),
      v.openapi('User')
    )
    const result = generateComponents([User], { openapi: '3.0.0' })
    expect(result.ok ? result.value.components : result).toStrictEqual({
      schemas: {
        Id: { type: 'string', format: 'uuid', description: 'The entity id' },
        User: {
          type: 'object',
          properties: {
            id: { $ref: '#/components/schemas/Id' },
            name: { type: 'string', minLength: 1, maxLength: 10 },
            age: { type: 'integer', minimum: 0, default: 18 },
            nickname: { type: 'string', nullable: true },
            tags: { type: 'array', items: { type: 'string' }, minItems: 1 },
            role: { type: 'string', enum: ['admin', 'user'] },
          },
          required: ['id', 'name', 'nickname', 'tags', 'role'],
        },
      },
      parameters: {},
    })
  })

  it('generates a 3.1 document with paths and webhooks', () => {
    const registry = OpenAPIRegistry()
    const User = registry.register('User', v.object({ name: v.string() }))
    registry.registerPath({
      method: 'get',
      path: '/users/{id}',
      request: {
        params: v.object({ id: v.pipe(v.string(), v.openapi({ param: { description: 'id' } })) }),
        query: v.object({ limit: v.optional(v.number()) }),
      },
      responses: {
        200: {
          description: 'OK',
          content: { 'application/json': { schema: v.nullable(v.array(User)) } },
        },
      },
    })
    registry.registerWebhook({
      method: 'post',
      path: 'userCreated',
      responses: { 200: { description: 'OK' } },
    })
    const document = generateDocument(registry.definitions, {
      openapi: '3.1.0',
      info: { title: 'API', version: '1.0.0' },
    })
    expect(document).toStrictEqual({
      ok: true,
      value: {
        openapi: '3.1.0',
        info: { title: 'API', version: '1.0.0' },
        components: {
          schemas: {
            User: {
              type: 'object',
              properties: { name: { type: 'string' } },
              required: ['name'],
            },
          },
          parameters: {},
        },
        paths: {
          '/users/{id}': {
            get: {
              parameters: [
                {
                  schema: { type: 'string' },
                  required: true,
                  description: 'id',
                  name: 'id',
                  in: 'path',
                },
                { schema: { type: 'number' }, required: false, name: 'limit', in: 'query' },
              ],
              responses: {
                200: {
                  description: 'OK',
                  content: {
                    'application/json': {
                      schema: {
                        type: ['array', 'null'],
                        items: { $ref: '#/components/schemas/User' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        webhooks: {
          userCreated: { post: { responses: { 200: { description: 'OK' } } } },
        },
      },
    })
  })
})
