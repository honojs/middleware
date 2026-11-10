import { describe, it, expect, expectTypeOf } from 'vitest'
import { createRoute, v } from '.'

describe('createRoute', () => {
  it.each([
    { path: '/users', expected: '/users' },
    { path: '/users/{id}', expected: '/users/:id' },
    { path: '/users/{uid}/posts/{postId}', expected: '/users/:uid/posts/:postId' },
  ])('createRoute(%j)', ({ path, expected }) => {
    const ParamsSchema = v.object({
      id: v.pipe(
        v.string(),
        v.minLength(3),
        v.openapi({
          param: {
            name: 'id',
            in: 'path',
          },
          example: '1212121',
        })
      ),
    })

    const UserSchema = v.object({
      id: v.pipe(
        v.string(),
        v.openapi({
          example: '123',
        })
      ),
      name: v.pipe(
        v.string(),
        v.openapi({
          example: 'John Doe',
        })
      ),
      age: v.pipe(
        v.number(),
        v.openapi({
          example: 42,
        })
      ),
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
