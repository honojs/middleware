import { Hono } from 'hono'
import type { MiddlewareHandler } from 'hono'
import type { ExtractSchema } from 'hono/types'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type { Equal, Expect, UnionToIntersection } from 'hono/utils/types'
import { expectTypeOf, vi } from 'vitest'
import { z } from 'zod/v3'
import { zValidator } from '.'

type Simplify<T> = { [K in keyof T]: T[K] }

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
  type AuthorInput = {
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
  type Expected = {
    '/author': {
      $post:
        | {
            input: AuthorInput
            output: {
              success: true
              message: string
              queryName: string | undefined
            }
            outputFormat: 'json'
            status: ContentfulStatusCode
          }
        | {
            input: AuthorInput
            output: z.SafeParseError<{ name: string; age: number }>
            outputFormat: 'json'
            status: 400
          }
        | {
            input: AuthorInput
            output: z.SafeParseError<{ name?: string | undefined } | undefined>
            outputFormat: 'json'
            status: 400
          }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type verify = Expect<Equal<Expected, Actual>>

  it('Should be assignable to a generic MiddlewareHandler', () => {
    const middleware: MiddlewareHandler = zValidator('json', jsonSchema)
    expect(middleware).toBeTypeOf('function')
  })

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
  type PageInput = {
    query: {
      page: string | string[]
    }
  }
  type Expected = {
    '/page': {
      $get:
        | {
            input: PageInput
            output: {
              page: number
            }
            outputFormat: 'json'
            status: ContentfulStatusCode
          }
        | {
            input: PageInput
            output: z.SafeParseError<z.input<typeof querySchema>>
            outputFormat: 'json'
            status: 400
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
    const mixedSchema = z.object({
      tenant: z.enum(['abba', 'baab']), // Should infer as literal union type
      page: z.coerce.number(), // Should fallback to string | string[]
    })
    const mixedRoute = new Hono().get('/mixed', zValidator('query', mixedSchema), (c) => {
      const query = c.req.valid('query')
      return c.json({ query })
    })

    type MixedActual = ExtractSchema<typeof mixedRoute>
    type MixedInput = {
      query: {
        tenant: 'abba' | 'baab' // Literal type preserved
        page: string | string[] // Coerce fallback type
      }
    }
    type MixedExpected = {
      '/mixed': {
        $get:
          | {
              input: MixedInput
              output: {
                query: {
                  tenant: 'abba' | 'baab' // Output uses inferred type
                  page: number // Coerce output type
                }
              }
              outputFormat: 'json'
              status: ContentfulStatusCode
            }
          | {
              input: MixedInput
              output: z.SafeParseError<z.input<typeof mixedSchema>>
              outputFormat: 'json'
              status: 400
            }
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    type verifyMixed = Expect<Equal<MixedExpected, MixedActual>>
  })
})

describe('ExtractSchema current path', () => {
  const jsonSchema = z.object({
    name: z.string(),
    age: z.number(),
  })

  const route = new Hono()
    .get('/users/:id', (c) => c.json({ id: c.req.param('id') }))
    .post('/users', zValidator('json', jsonSchema), (c) => {
      const data = c.req.valid('json')
      return c.json({ created: data }, 201)
    })

  it('infers validator failures only for the current path', () => {
    type Actual = ExtractSchema<typeof route>
    type Expected = {
      '/users/:id': {
        $get: {
          input: {
            param: {
              id: string
            }
          }
          output: {
            id: string
          }
          outputFormat: 'json'
          status: ContentfulStatusCode
        }
      }
    } & {
      '/users': {
        $post:
          | {
              input: {
                json: {
                  name: string
                  age: number
                }
              }
              output: {
                created: {
                  name: string
                  age: number
                }
              }
              outputFormat: 'json'
              status: 201
            }
          | {
              input: {
                json: {
                  name: string
                  age: number
                }
              }
              output: z.SafeParseError<z.input<typeof jsonSchema>>
              outputFormat: 'json'
              status: 400
            }
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    type verify = Expect<Equal<Expected, Actual>>
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
        type verify2 = Expect<Equal<z.ZodError, typeof result.error>>
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
        | {
            input: {
              json: {
                id: number
                title: string
              }
            }
            output: z.SafeParseError<z.input<typeof schema>>
            outputFormat: 'json'
            status: 400
          }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type verify = Expect<Equal<Expected, Actual>>

  it('Should be assignable to a generic MiddlewareHandler', () => {
    const middleware: MiddlewareHandler = zValidator('json', schema, (result, c) => {
      if (!result.success) {
        return c.json({ error: 'invalid' }, 400)
      }
    })
    expect(middleware).toBeTypeOf('function')
  })

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

describe('With Hook Always Returning Response', () => {
  const schema = z.object({
    id: z.number(),
    title: z.string(),
  })

  const app = new Hono().post(
    '/post',
    zValidator('json', schema, (result, c) => {
      // Failed validation can leave a string here despite the inferred number type.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-conversion
      if (!result.success && Number(result.data.id) === 123) {
        return c.text(`${result.data.id} is invalid!`, 400)
      }

      return c.text(`${result.data.id} is even more invalid!`, 400)
    }),
    (c) => {
      const data = c.req.valid('json')
      return c.text(`${data.id} is valid!`)
    }
  )

  type Actual = ExtractSchema<typeof app>
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
            output: `${number} is even more invalid!`
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

  it('Should return hook response when validation fails', async () => {
    const req = new Request('http://localhost/post', {
      body: JSON.stringify({
        id: 'abc',
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
    expect(await res.text()).toBe('abc is even more invalid!')
  })
})

describe('With Hook Returning Undefined', () => {
  const schema = z.object({
    id: z.number(),
    title: z.string(),
  })

  const app = new Hono().post(
    '/post',
    zValidator('json', schema, (result, c) => {
      // Failed validation can leave a string here despite the inferred number type.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-conversion
      if (!result.success && Number(result.data.id) === 123) {
        return c.text(`${result.data.id} is invalid!`, 400)
      }
    }),
    (c) => {
      const data = c.req.valid('json')
      return c.text(`${data.id} is valid!`)
    }
  )

  type Actual = ExtractSchema<typeof app>
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
            output: z.SafeParseError<z.input<typeof schema>>
            outputFormat: 'json'
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

  it('Should return default 400 response when hook returns undefined', async () => {
    const req = new Request('http://localhost/post', {
      body: JSON.stringify({
        id: 'abc',
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
    const data = (await res.json()) as { success: boolean }
    expect(data['success']).toBe(false)
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
  describe('all validation targets', () => {
    const jsonSchema = z.object({ jsonName: z.string() })
    const formSchema = z.object({ formName: z.string() })
    const querySchema = z.object({ q: z.string() })
    const paramSchema = z.object({ id: z.string() })
    const headerSchema = z.object({ authorization: z.string() })
    const cookieSchema = z.object({ session: z.string() })

    type Failure<T extends z.ZodTypeAny> = z.SafeParseError<z.output<T>>

    it('infers json input and failure response', () => {
      const route = new Hono().post('/json', zValidator('json', jsonSchema), (c) => {
        const data = c.req.valid('json')
        expectTypeOf(data).toEqualTypeOf<{ jsonName: string }>()
        return c.json(data, 201)
      })

      type Actual = ExtractSchema<typeof route>['/json']['$post']
      type verifySuccessInput = Expect<
        Equal<{ json: { jsonName: string } }, (Actual & { status: 201 })['input']>
      >
      type verifySuccessOutput = Expect<
        Equal<{ jsonName: string }, (Actual & { status: 201 })['output']>
      >
      type verifyFailureInput = Expect<
        Equal<{ json: { jsonName: string } }, (Actual & { status: 400 })['input']>
      >
      type verifyFailureOutput = Expect<
        Equal<Failure<typeof jsonSchema>, (Actual & { status: 400 })['output']>
      >
    })

    it('infers form input and failure response', () => {
      const route = new Hono().post('/form', zValidator('form', formSchema), (c) => {
        const data = c.req.valid('form')
        expectTypeOf(data).toEqualTypeOf<{ formName: string }>()
        return c.json(data, 201)
      })

      type Actual = ExtractSchema<typeof route>['/form']['$post']
      type verifySuccessInput = Expect<
        Equal<{ form: { formName: string } }, (Actual & { status: 201 })['input']>
      >
      type verifySuccessOutput = Expect<
        Equal<{ formName: string }, (Actual & { status: 201 })['output']>
      >
      type verifyFailureInput = Expect<
        Equal<{ form: { formName: string } }, (Actual & { status: 400 })['input']>
      >
      type verifyFailureOutput = Expect<
        Equal<Failure<typeof formSchema>, (Actual & { status: 400 })['output']>
      >
    })

    it('infers query input and failure response', () => {
      const route = new Hono().get('/query', zValidator('query', querySchema), (c) => {
        const data = c.req.valid('query')
        expectTypeOf(data).toEqualTypeOf<{ q: string }>()
        return c.json(data, 200)
      })

      type Actual = ExtractSchema<typeof route>['/query']['$get']
      type verifySuccessInput = Expect<
        Equal<{ query: { q: string } }, (Actual & { status: 200 })['input']>
      >
      type verifySuccessOutput = Expect<Equal<{ q: string }, (Actual & { status: 200 })['output']>>
      type verifyFailureInput = Expect<
        Equal<{ query: { q: string } }, (Actual & { status: 400 })['input']>
      >
      type verifyFailureOutput = Expect<
        Equal<Failure<typeof querySchema>, (Actual & { status: 400 })['output']>
      >
    })

    it('infers param input and failure response', () => {
      const route = new Hono().get('/param/:id', zValidator('param', paramSchema), (c) => {
        const data = c.req.valid('param')
        expectTypeOf(data).toEqualTypeOf<{ id: string }>()
        return c.json(data, 200)
      })

      type Actual = ExtractSchema<typeof route>['/param/:id']['$get']
      type verifySuccessInput = Expect<
        Equal<{ param: { id: string } }, (Actual & { status: 200 })['input']>
      >
      type verifySuccessOutput = Expect<Equal<{ id: string }, (Actual & { status: 200 })['output']>>
      type verifyFailureInput = Expect<
        Equal<{ param: { id: string } }, (Actual & { status: 400 })['input']>
      >
      type verifyFailureOutput = Expect<
        Equal<Failure<typeof paramSchema>, (Actual & { status: 400 })['output']>
      >
    })

    it('infers header input and failure response', () => {
      const route = new Hono().get('/header', zValidator('header', headerSchema), (c) => {
        const data = c.req.valid('header')
        expectTypeOf(data).toEqualTypeOf<{ authorization: string }>()
        return c.json(data, 200)
      })

      type Actual = ExtractSchema<typeof route>['/header']['$get']
      type verifySuccessInput = Expect<
        Equal<{ header: { authorization: string } }, (Actual & { status: 200 })['input']>
      >
      type verifySuccessOutput = Expect<
        Equal<{ authorization: string }, (Actual & { status: 200 })['output']>
      >
      type verifyFailureInput = Expect<
        Equal<{ header: { authorization: string } }, (Actual & { status: 400 })['input']>
      >
      type verifyFailureOutput = Expect<
        Equal<Failure<typeof headerSchema>, (Actual & { status: 400 })['output']>
      >
    })

    it('infers cookie input and failure response', () => {
      const route = new Hono().get('/cookie', zValidator('cookie', cookieSchema), (c) => {
        const data = c.req.valid('cookie')
        expectTypeOf(data).toEqualTypeOf<{ session: string }>()
        return c.json(data, 200)
      })

      type Actual = ExtractSchema<typeof route>['/cookie']['$get']
      type verifySuccessInput = Expect<
        Equal<{ cookie: { session: string } }, (Actual & { status: 200 })['input']>
      >
      type verifySuccessOutput = Expect<
        Equal<{ session: string }, (Actual & { status: 200 })['output']>
      >
      type verifyFailureInput = Expect<
        Equal<{ cookie: { session: string } }, (Actual & { status: 400 })['input']>
      >
      type verifyFailureOutput = Expect<
        Equal<Failure<typeof cookieSchema>, (Actual & { status: 400 })['output']>
      >
    })

    it('infers composed inputs and all failure responses', () => {
      const route = new Hono().post(
        '/all/:id',
        zValidator('param', paramSchema),
        zValidator('query', querySchema),
        zValidator('header', headerSchema),
        zValidator('cookie', cookieSchema),
        zValidator('json', jsonSchema),
        zValidator('form', formSchema),
        (c) => {
          const param = c.req.valid('param')
          const query = c.req.valid('query')
          const header = c.req.valid('header')
          const cookie = c.req.valid('cookie')
          const json = c.req.valid('json')
          const form = c.req.valid('form')

          expectTypeOf(param).toEqualTypeOf<{ id: string }>()
          expectTypeOf(query).toEqualTypeOf<{ q: string }>()
          expectTypeOf(header).toEqualTypeOf<{ authorization: string }>()
          expectTypeOf(cookie).toEqualTypeOf<{ session: string }>()
          expectTypeOf(json).toEqualTypeOf<{ jsonName: string }>()
          expectTypeOf(form).toEqualTypeOf<{ formName: string }>()

          return c.json(
            {
              id: param.id,
              q: query.q,
              authorization: header.authorization,
              session: cookie.session,
              jsonName: json.jsonName,
              formName: form.formName,
            },
            201
          )
        }
      )

      type Actual = ExtractSchema<typeof route>['/all/:id']['$post']
      type ExpectedInput = {
        param: { id: string }
        query: { q: string }
        header: { authorization: string }
        cookie: { session: string }
        json: { jsonName: string }
        form: { formName: string }
      }
      type ExpectedFailure =
        | Failure<typeof paramSchema>
        | Failure<typeof querySchema>
        | Failure<typeof headerSchema>
        | Failure<typeof cookieSchema>
        | Failure<typeof jsonSchema>
        | Failure<typeof formSchema>

      type verifySuccessInput = Expect<
        Equal<ExpectedInput, Simplify<UnionToIntersection<(Actual & { status: 201 })['input']>>>
      >
      type verifySuccessOutput = Expect<
        Equal<
          {
            id: string
            q: string
            authorization: string
            session: string
            jsonName: string
            formName: string
          },
          (Actual & { status: 201 })['output']
        >
      >
      type verifyFailureInput = Expect<
        Equal<ExpectedInput, Simplify<UnionToIntersection<(Actual & { status: 400 })['input']>>>
      >
      type verifyFailureOutput = Expect<
        Equal<ExpectedFailure, (Actual & { status: 400 })['output']>
      >
    })
  })

  it('Should return correct enum types for query', () => {
    const app = new Hono()

    const querySchema = z.object({
      order: z.enum(['asc', 'desc']),
      orderWithDefault: z.enum(['asc', 'desc']).default('asc'),
      page: z.number(),
    })

    const route = app.get('/', zValidator('query', querySchema), (c) => {
      const data = c.req.valid('query')
      return c.json(data)
    })

    type Actual = ExtractSchema<typeof route>
    type EnumInput = {
      query: {
        order: 'asc' | 'desc'
        orderWithDefault?: 'asc' | 'desc' | undefined
        page: string | string[]
      }
    }
    type Expected = {
      '/': {
        $get:
          | {
              input: EnumInput
              output: {
                order: 'asc' | 'desc'
                orderWithDefault: 'asc' | 'desc'
                page: number
              }
              outputFormat: 'json'
              status: ContentfulStatusCode
            }
          | {
              input: EnumInput
              output: z.SafeParseError<z.input<typeof querySchema>>
              outputFormat: 'json'
              status: 400
            }
      }
    }
    type verify = Expect<Equal<Expected, Actual>>
  })
})

describe('Case-Insensitive Headers', () => {
  it('Should inspect the header schema shape only once', async () => {
    const app = new Hono()
    const headerSchema = z.object({
      Authorization: z.string(),
    })
    const shape = headerSchema.shape
    let shapeInspections = 0
    Object.defineProperty(headerSchema, 'shape', {
      value: new Proxy(shape, {
        ownKeys(target) {
          shapeInspections++
          return Reflect.ownKeys(target)
        },
      }),
    })

    app.get('/', zValidator('header', headerSchema), (c) => c.json(c.req.valid('header')))

    await app.request('/', { headers: { Authorization: 'Bearer token' } })
    await app.request('/', { headers: { Authorization: 'Bearer token' } })

    expect(shapeInspections).toBe(1)
  })

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
    type HeaderInput = {
      header: z.infer<typeof headerSchema>
    }
    type Expected = {
      '/': {
        $get:
          | {
              input: HeaderInput
              output: z.infer<typeof headerSchema>
              outputFormat: 'json'
              status: ContentfulStatusCode
            }
          | {
              input: HeaderInput
              output: z.SafeParseError<z.input<typeof headerSchema>>
              outputFormat: 'json'
              status: 400
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

  type ExtendedInput = {
    json: {
      name: string
      age: number
    }
  }
  type Actual = ExtractSchema<typeof route>['/extended']['$post']
  type Expected =
    | {
        input: ExtendedInput
        output: {
          success: true
          data: {
            name: string
            age: number
          }
        }
        outputFormat: 'json'
        status: ContentfulStatusCode
      }
    | {
        input: ExtendedInput
        output: z.SafeParseError<z.input<typeof jsonSchema>>
        outputFormat: 'json'
        status: 400
      }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type verify = Expect<Equal<Expected, Actual>>

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
