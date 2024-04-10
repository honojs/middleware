import { describe, it, expect, expectTypeOf } from 'vitest'
import { createRoute, z } from '../src/index'

describe('createRoute', () => {
  it.each([
    { path: '/users', expected: '/users' },
    { path: '/users/{id}', expected: '/users/:id' },
    { path: '/users/{uid}/posts/{postId}', expected: '/users/:uid/posts/:postId' },
  ])('createRoute(%j)', ({ path, expected }) => {
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

    const UserSchema = z.object({
      id: z.string().openapi({
        example: '123',
      }),
      name: z.string().openapi({
        example: 'John Doe',
      }),
      age: z.number().openapi({
        example: 42,
      }),
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
