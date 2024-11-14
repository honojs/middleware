import { describe, it, expect, expectTypeOf } from 'vitest'
import { Type as T } from '@sinclair/typebox'
import { createRoute } from '../src/index'

describe('createRoute', () => {
  it.each([
    { path: '/users', expected: '/users' },
    { path: '/users/{id}', expected: '/users/:id' },
    { path: '/users/{uid}/posts/{postId}', expected: '/users/:uid/posts/:postId' },
  ])('createRoute(%j)', ({ path, expected }) => {
    const ParamsSchema = T.Object({
      id: T.String({ minLength: 3, examples: ['1212121'] }),
    })

    const UserSchema = T.Object({
      id: T.String({ examples: ['123'] }),
      name: T.String({ examples: ['John Doe'] }),
      age: T.Number({ examples: [42] }),
    })

    const config = {
      method: 'get',
      path,
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
          description: 'Retrieve the user',
        },
      },
    } as const
    const route = createRoute(config)
    expect(route).toEqual(config)
    expect(route.getRoutingPath()).toBe(expected)
    expectTypeOf(route.getRoutingPath()).toEqualTypeOf<typeof expected>()
  })
})
