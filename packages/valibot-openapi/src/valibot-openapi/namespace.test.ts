import * as valibot from 'valibot'
import { describe, expect, it } from 'vitest'

import {
  OpenAPIRegistry,
  generateComponents,
  generateDocument,
  getOpenApiMetadata,
  getRefId,
} from './index'
import * as v from './index'

describe('root entry', () => {
  it('exposes openapi as a pipe action next to v.metadata (valibot idiom)', () => {
    const Id = v.pipe(v.string(), v.uuid(), v.openapi({ description: 'The id' }))
    expect(getOpenApiMetadata(Id)).toStrictEqual({ description: 'The id' })
    expect(v.parse(Id, '7f2c0f6e-1b1a-4d4a-9a8e-2a7a8f4a1c11')).toBe(
      '7f2c0f6e-1b1a-4d4a-9a8e-2a7a8f4a1c11'
    )
  })

  it('registers a refId through the action and composes with valibot metadata actions', () => {
    const User = v.pipe(
      v.object({ name: v.pipe(v.string(), v.openapi({ example: 'John' })) }),
      v.description('A user'),
      v.openapi('User')
    )
    expect(getRefId(User)).toBe('User')
    expect(generateComponents([User], { openapi: '3.0.0' })).toStrictEqual({
      ok: true,
      value: {
        components: {
          schemas: {
            User: {
              type: 'object',
              properties: { name: { type: 'string', example: 'John' } },
              required: ['name'],
              description: 'A user',
            },
          },
          parameters: {},
        },
      },
    })
  })

  it('re-exports valibot unchanged', () => {
    expect(v.string).toBe(valibot.string)
    expect(v.pipe).toBe(valibot.pipe)
    expect(v.EMAIL_REGEX).toBe(valibot.EMAIL_REGEX)
    expect(v.ValiError).toBe(valibot.ValiError)
  })

  it('reproduces the README example document', () => {
    const registry = OpenAPIRegistry()
    const UserIdSchema = registry.registerParameter(
      'UserId',
      v.pipe(v.string(), v.openapi({ param: { name: 'id', in: 'path' }, example: '1212121' }))
    )
    const UserSchema = v.pipe(
      v.object({
        id: v.pipe(v.string(), v.openapi({ example: '1212121' })),
        name: v.pipe(v.string(), v.openapi({ example: 'John Doe' })),
        age: v.pipe(v.number(), v.openapi({ example: 42 })),
      }),
      v.openapi('User')
    )
    const bearerAuth = registry.registerComponent('securitySchemes', 'bearerAuth', {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    })
    registry.registerPath({
      method: 'get',
      path: '/users/{id}',
      description: 'Get user data by its id',
      summary: 'Get a single user',
      security: [{ [bearerAuth.name]: [] }],
      request: { params: v.object({ id: UserIdSchema }) },
      responses: {
        200: {
          description: 'Object with user data.',
          content: { 'application/json': { schema: UserSchema } },
        },
        204: { description: 'No content - successful operation' },
      },
    })
    const info = { version: '1.0.0', title: 'My API', description: 'This is the API' }
    expect(
      generateDocument(registry.definitions, {
        openapi: '3.0.0',
        info,
        servers: [{ url: 'v1' }],
      })
    ).toStrictEqual({
      ok: true,
      value: {
        openapi: '3.0.0',
        info,
        servers: [{ url: 'v1' }],
        components: {
          securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
          schemas: {
            UserId: { type: 'string', example: '1212121' },
            User: {
              type: 'object',
              properties: {
                id: { type: 'string', example: '1212121' },
                name: { type: 'string', example: 'John Doe' },
                age: { type: 'number', example: 42 },
              },
              required: ['id', 'name', 'age'],
            },
          },
          parameters: {
            UserId: {
              schema: { $ref: '#/components/schemas/UserId' },
              required: true,
              name: 'id',
              in: 'path',
            },
          },
        },
        paths: {
          '/users/{id}': {
            get: {
              description: 'Get user data by its id',
              summary: 'Get a single user',
              security: [{ bearerAuth: [] }],
              parameters: [{ $ref: '#/components/parameters/UserId' }],
              responses: {
                '200': {
                  description: 'Object with user data.',
                  content: {
                    'application/json': { schema: { $ref: '#/components/schemas/User' } },
                  },
                },
                '204': { description: 'No content - successful operation' },
              },
            },
          },
        },
      },
    })
  })
})
