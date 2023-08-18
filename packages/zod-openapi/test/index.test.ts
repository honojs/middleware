// eslint-disable-next-line node/no-extraneous-import
import { describe, it, expect } from 'vitest'
import { OpenAPIHono, createRoute, z } from '../src'

describe('Basic', () => {
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

  it('Should return 200 response with correct contents', async () => {
    const res = await app.request('/users/123')
    expect(res.status).toBe(200)
  })

  it('Should return 400 response with correct contents', async () => {
    const res = await app.request('/users/1')
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ ok: false })
  })
})
