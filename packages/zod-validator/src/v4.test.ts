import { Hono } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type { Equal, Expect } from 'hono/utils/types'
import { vi } from 'vitest'
import type z4 from 'zod/v4'
import { z } from 'zod/v4'
import { zValidator } from '.'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type ExtractSchema<T> = T extends Hono<infer _, infer S> ? S : never

describe('Basic', () => {
  const app = new Hono()

  const jsonSchema = z.object({
    name: z.string(),
    age: z.number(),
  })

  const querySchema = z
    .object({
      name: z.string().optional(),
    })
    .optional()

  const route = app.post(
    '/author',
    zValidator('json', jsonSchema),
    zValidator('query', querySchema),
    (c) => {
      const data = c.req.valid('json')
      const query = c.req.valid('query')

      return c.json({
        success: true,
        message: `${data.name} is ${data.age}`,
        queryName: query?.name,
      })
    }
  )

  type Actual = ExtractSchema<typeof route>
  type Expected = {
    '/author': {
      $post: {
        input: {
          json: {
            name: string
            age: number
          }
        } & {
          query?:
            | {
                name?: string | undefined
              }
            | undefined
        }
        output: {
          success: true
          message: string
          queryName: string | undefined
        }
        outputFormat: 'json'
        status: ContentfulStatusCode
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type verify = Expect<Equal<Expected, Actual>>

  it('Should return 200 response', async () => {
    const req = new Request('http://localhost/author?name=Metallo', {
      body: JSON.stringify({
        name: 'Superman',
        age: 20,
      }),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    const res = await app.request(req)
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      success: true,
      message: 'Superman is 20',
      queryName: 'Metallo',
    })
  })

  it('Should return 400 response', async () => {
    const req = new Request('http://localhost/author', {
      body: JSON.stringify({
        name: 'Superman',
        age: '20',
      }),
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
    })
    const res = await app.request(req)
    expect(res).not.toBeNull()
    expect(res.status).toBe(400)
    const data = (await res.json()) as { success: boolean }
    expect(data['success']).toBe(false)
  })
})

describe('coerce', () => {
  const app = new Hono()

  const querySchema = z.object({
    page: z.coerce.number(),
  })

  const route = app.get('/page', zValidator('query', querySchema), (c) => {
    const { page } = c.req.valid('query')
    return c.json({ page })
  })

  type Actual = ExtractSchema<typeof route>
  type Expected = {
    '/page': {
      $get: {
        input: {
          query: {
            page: string | string[]
          }
        }
        output: {
          page: number
        }
        outputFormat: 'json'
        status: ContentfulStatusCode
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type verify = Expect<Equal<Expected, Actual>>

  it('Should return 200 response', async () => {
    const res = await app.request('/page?page=123')
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      page: 123,
    })
  })

  it('Should correctly infer literal types for enum and fallback for coerce schemas', () => {
    // Related to issue #1370: Type inference for coerce and enum schemas
    const mixedRoute = new Hono().get(
      '/mixed',
      zValidator(
        'query',
        z.object({
          tenant: z.enum(['abba', 'baab']), // Should infer as literal union type
          page: z.coerce.number(), // Should fallback to string | string[]
        })
      ),
      (c) => {
        const query = c.req.valid('query')
        return c.json({ query })
      }
    )

    type MixedActual = ExtractSchema<typeof mixedRoute>
    type MixedExpected = {
      '/mixed': {
        $get: {
          input: {
            query: {
              tenant: 'abba' | 'baab' // Literal type preserved
              page: string | string[] // Coerce fallback type
            }
          }
          output: {
            query: {
              tenant: 'abba' | 'baab' // Output uses inferred type
              page: number // Coerce output type
            }
          }
          outputFormat: 'json'
          status: ContentfulStatusCode
        }
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    type verifyMixed = Expect<Equal<MixedExpected, MixedActual>>
  })
})

describe('With Hook', () => {
  const app = new Hono()

  const schema = z.object({
    id: z.number(),
    title: z.string(),
  })

  const route = app.post(
    '/post',
    zValidator('json', schema, (result, c) => {
      if (!result.success) {
        type verify = Expect<Equal<number, typeof result.data.id>>
        type verify2 = Expect<
          Equal<z4.core.$ZodError<z4.output<typeof schema>>, typeof result.error>
        >
        const flattenedError = z.flattenError(result.error)
        const fieldErrors = flattenedError.fieldErrors
        type verify3 = Expect<Equal<{ id?: string[]; title?: string[] }, typeof fieldErrors>>
        return c.text(`${result.data.id} is invalid!`, 400)
      }
    }),
    (c) => {
      const data = c.req.valid('json')
      return c.text(`${data.id} is valid!`)
    }
  )

  type Actual = ExtractSchema<typeof route>
  type Expected = {
    '/post': {
      $post:
        | {
            input: {
              json: {
                id: number
                title: string
              }
            }
            output: `${number} is invalid!`
            outputFormat: 'text'
            status: 400
          }
        | {
            input: {
              json: {
                id: number
                title: string
              }
            }
            output: `${number} is valid!`
            outputFormat: 'text'
            status: ContentfulStatusCode
          }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type verify = Expect<Equal<Expected, Actual>>

  it('Should return 200 response', async () => {
    const req = new Request('http://localhost/post', {
      body: JSON.stringify({
        id: 123,
        title: 'Hello',
      }),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    const res = await app.request(req)
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('123 is valid!')
  })

  it('Should return 400 response', async () => {
    const req = new Request('http://localhost/post', {
      body: JSON.stringify({
        id: '123',
        title: 'Hello',
      }),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    const res = await app.request(req)
    expect(res).not.toBeNull()
    expect(res.status).toBe(400)
    expect(await res.text()).toBe('123 is invalid!')
  })
})

describe('With Async Hook', () => {
  const app = new Hono()

  const schema = z.object({
    id: z.number(),
    title: z.string(),
  })

  app.post(
    '/post',
    zValidator('json', schema, async (result, c) => {
      if (!result.success) {
        return c.text(`${result.data.id} is invalid!`, 400)
      }
    }),
    (c) => {
      const data = c.req.valid('json')
      return c.text(`${data.id} is valid!`)
    }
  )

  it('Should return 200 response', async () => {
    const req = new Request('http://localhost/post', {
      body: JSON.stringify({
        id: 123,
        title: 'Hello',
      }),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    const res = await app.request(req)
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('123 is valid!')
  })

  it('Should return 400 response', async () => {
    const req = new Request('http://localhost/post', {
      body: JSON.stringify({
        id: '123',
        title: 'Hello',
      }),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    const res = await app.request(req)
    expect(res).not.toBeNull()
    expect(res.status).toBe(400)
    expect(await res.text()).toBe('123 is invalid!')
  })
})

describe('With target', () => {
  it('should call hook for correctly validated target', async () => {
    const app = new Hono()

    const schema = z.object({
      id: z.string(),
    })

    const jsonHook = vi.fn()
    const paramHook = vi.fn()
    const queryHook = vi.fn()
    app.post(
      '/:id/post',
      zValidator('json', schema, jsonHook),
      zValidator('param', schema, paramHook),
      zValidator('query', schema, queryHook),
      (c) => {
        return c.text('ok')
      }
    )

    const req = new Request('http://localhost/1/post?id=2', {
      body: JSON.stringify({
        id: '3',
      }),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const res = await app.request(req)
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('ok')
    expect(paramHook).toHaveBeenCalledWith(
      { data: { id: '1' }, success: true, target: 'param' },
      expect.anything()
    )
    expect(queryHook).toHaveBeenCalledWith(
      { data: { id: '2' }, success: true, target: 'query' },
      expect.anything()
    )
    expect(jsonHook).toHaveBeenCalledWith(
      { data: { id: '3' }, success: true, target: 'json' },
      expect.anything()
    )
  })
})

describe('Only Types', () => {
  it('Should return correct enum types for query', () => {
    const app = new Hono()

    const querySchema = z.object({
      order: z.enum(['asc', 'desc']),
    })

    const route = app.get('/', zValidator('query', querySchema), (c) => {
      const data = c.req.valid('query')
      return c.json(data)
    })

    type Actual = ExtractSchema<typeof route>
    type Expected = {
      '/': {
        $get: {
          input: {
            query: {
              order: 'asc' | 'desc'
            }
          }
          output: {
            order: 'asc' | 'desc'
          }
          outputFormat: 'json'
          status: ContentfulStatusCode
        }
      }
    }
    type verify = Expect<Equal<Expected, Actual>>
  })
})

describe('Case-Insensitive Headers', () => {
  it('Should ignore the case for headers in the Zod schema and return 200', () => {
    const app = new Hono()
    const headerSchema = z.object({
      'Content-Type': z.string(),
      ApiKey: z.string(),
      onlylowercase: z.string(),
      ONLYUPPERCASE: z.string(),
    })

    const route = app.get('/', zValidator('header', headerSchema), (c) => {
      const headers = c.req.valid('header')
      return c.json(headers)
    })

    type Actual = ExtractSchema<typeof route>
    type Expected = {
      '/': {
        $get: {
          input: {
            header: z.infer<typeof headerSchema>
          }
          output: z.infer<typeof headerSchema>
          outputFormat: 'json'
          status: ContentfulStatusCode
        }
      }
    }
    type verify = Expect<Equal<Expected, Actual>>
  })
})

describe('With options + validationFunction', () => {
  const app = new Hono()
  const jsonSchema = z.object({
    name: z.string(),
    age: z.number(),
  })

  const route = app
    .post('/', zValidator('json', jsonSchema), (c) => {
      const data = c.req.valid('json')
      return c.json({
        success: true,
        data,
      })
    })
    .post(
      '/extended',
      zValidator('json', jsonSchema, undefined, {
        validationFunction: async (schema, value) => {
          const result = schema.safeParse(value)
          return await schema.passthrough().safeParseAsync(value)
        },
      }),
      (c) => {
        const data = c.req.valid('json')
        return c.json({
          success: true,
          data,
        })
      }
    )

  it('Should be ok due to passthrough schema', async () => {
    const req = new Request('http://localhost/extended', {
      body: JSON.stringify({
        name: 'Superman',
        age: 20,
        length: 170,
        weight: 55,
      }),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    const res = await app.request(req)
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      success: true,
      data: {
        name: 'Superman',
        age: 20,
        length: 170,
        weight: 55,
      },
    })
  })
  it('Should be ok due to required schema', async () => {
    const req = new Request('http://localhost', {
      body: JSON.stringify({
        name: 'Superman',
        age: 20,
      }),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    const res = await app.request(req)

    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      success: true,
      data: {
        name: 'Superman',
        age: 20,
      },
    })
  })
})

describe('Transform', () => {
  const schema = z
    .object({
      'user-agent': z.string(),
    })
    .transform((data) => ({
      userAgent: data['user-agent'],
    }))

  const zValidatorHeader = zValidator('header', schema)

  const app = new Hono()

  app.post('/test', zValidatorHeader, async (c) => {
    const header = c.req.valid('header')
    return c.json(header)
  })

  it('Should return 400 response', async () => {
    const res = await app.request('/test', {
      method: 'POST',
    })
    expect(res.status).toBe(400)
  })

  it('Should return 200 response', async () => {
    const res = await app.request('/test', {
      method: 'POST',
      headers: {
        'user-agent': 'my-agent',
      },
    })
    expect(res.status).toBe(200)
  })
})
