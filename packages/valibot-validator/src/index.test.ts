import { Hono } from 'hono'
import type { TypedResponse } from 'hono'
import type { ExtractSchema } from 'hono/types'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type { Equal, Expect, UnionToIntersection } from 'hono/utils/types'
import type { InferIssue, NumberIssue, ObjectIssue, StringIssue } from 'valibot'
import * as v from 'valibot'
import type { FailedResponse } from '.'
import { vValidator } from '.'

type MergeDiscriminatedUnion<U> =
  UnionToIntersection<U> extends infer O ? { [K in keyof O]: O[K] } : never
type FailedResponseOutput<T extends v.GenericSchema | v.GenericSchemaAsync> =
  FailedResponse<T> extends TypedResponse<infer O, 400, 'json'> ? O : never

describe('Basic', () => {
  const app = new Hono()

  const schema = v.object({
    name: v.string(),
    age: v.number(),
  })

  const querySchema = v.optional(
    v.object({
      search: v.optional(v.string()),
      page: v.optional(v.number()),
    })
  )

  const route = app
    .post('/author', vValidator('json', schema), vValidator('query', querySchema), (c) => {
      const data = c.req.valid('json')
      const query = c.req.valid('query')

      return c.json(
        {
          success: true,
          message: `${data.name} is ${data.age}, search is ${query?.search}`,
        },
        200
      )
    })
    .post(
      '/with-hook',
      vValidator('query', querySchema, (result, c) => {
        if (!result.success) {
          return c.text('Invalid query', 400)
        }
      }),
      vValidator('json', schema, (result, c) => {
        if (!result.success) {
          if (!result.typed) {
            return c.text('Invalid data', 400)
          } else {
            return undefined as unknown as FailedResponse<typeof schema> &
              TypedResponse<{ typed: true }, 400, 'json'>
          }
        }
      }),
      (c) => {
        const data = c.req.valid('json')
        return c.json(data, 200)
      }
    )

  type Actual = ExtractSchema<typeof route>
  type withoutHook_verifyInput = Expect<
    Equal<
      {
        json: {
          name: string
          age: number
        }
        query?:
          | {
              search?: string | string[]
              page?: string | string[]
            }
          | undefined
      },
      MergeDiscriminatedUnion<(Actual['/author']['$post'] & { status: 200 })['input']>
    >
  >
  type withoutHook_verifySuccessOutput = Expect<
    Equal<
      {
        success: true
        message: string
      },
      MergeDiscriminatedUnion<(Actual['/author']['$post'] & { status: 200 })['output']>
    >
  >
  type withoutHook_verifyErrorOutput = Expect<
    Equal<
      | {
          readonly typed: true
          readonly success: false
          readonly output: {
            name: string
            age: number
          }
          readonly issues: [
            StringIssue | NumberIssue | ObjectIssue,
            ...(StringIssue | NumberIssue | ObjectIssue)[],
          ]
        }
      | {
          readonly typed: false
          readonly success: false
          readonly output: unknown
          readonly issues: [
            StringIssue | NumberIssue | ObjectIssue,
            ...(StringIssue | NumberIssue | ObjectIssue)[],
          ]
        }
      | {
          readonly typed: true
          readonly success: false
          readonly output:
            | {
                search?: string | undefined
                page?: number | undefined
              }
            | undefined
          readonly issues: [
            StringIssue | NumberIssue | ObjectIssue,
            ...(StringIssue | NumberIssue | ObjectIssue)[],
          ]
        },
      (Actual['/author']['$post'] & { status: 400 })['output']
    >
  >

  type withHook_verifyInput = Expect<
    Equal<
      {
        json: {
          name: string
          age: number
        }
        query?:
          | {
              search?: string | string[]
              page?: string | string[]
            }
          | undefined
      },
      MergeDiscriminatedUnion<(Actual['/with-hook']['$post'] & { status: 200 })['input']>
    >
  >
  type withHook_verifySuccessOutput = Expect<
    Equal<
      {
        name: string
        age: number
      },
      MergeDiscriminatedUnion<(Actual['/with-hook']['$post'] & { status: 200 })['output']>
    >
  >

  type WithHookErrorOutput = (Actual['/with-hook']['$post'] & { status: 400 })['output']
  type withHook_verifyErrorJsonOutput = Expect<
    Equal<
      | (FailedResponseOutput<typeof schema> & { typed: true })
      | FailedResponseOutput<typeof schema>
      | FailedResponseOutput<typeof querySchema>,
      Extract<WithHookErrorOutput, { success: false }>
    >
  >
  type withHook_verifyErrorTextOutput = Expect<
    Equal<'Invalid query' | 'Invalid data', Extract<WithHookErrorOutput, string>>
  >

  it('Should return 200 response', async () => {
    const req = new Request('http://localhost/author?search=hello', {
      body: JSON.stringify({
        name: 'Superman',
        age: 20,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    })
    const res = await app.request(req)
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      success: true,
      message: 'Superman is 20, search is hello',
    })
  })

  it('Should return 400 response', async () => {
    const req = new Request('http://localhost/author', {
      body: JSON.stringify({
        name: 'Superman',
        age: '20',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    })
    const res = await app.request(req)
    expect(res).not.toBeNull()
    expect(res.status).toBe(400)
    const data = (await res.json()) as { success: boolean }
    expect(data['success']).toBe(false)
  })
})

describe('Sensitive Data Removal', () => {
  it("doesn't return cookies after headers validation", async () => {
    const app = new Hono()
    const schema = v.object({
      'user-agent': v.string(),
    })

    app.get('/headers', vValidator('header', schema), (c) =>
      c.json({ success: true, userAgent: c.req.header('User-Agent') })
    )

    const req = new Request('http://localhost/headers', {
      headers: {
        // Not passing the User-Agent header to trigger the validation error
        Cookie: 'SECRET=123',
      },
    })

    const res = await app.request(req)
    expect(res.status).toBe(400)
    const body = await res.text()
    expect(body).not.toContain('SECRET=123')
    const data = JSON.parse(body) as { success: boolean; issues: unknown[] }
    expect(data.success).toBe(false)
    expect(data.issues.length).toBeGreaterThan(0)
  })
})

describe('ExtractSchema current path', () => {
  const schema = v.object({
    name: v.string(),
    age: v.number(),
  })

  const route = new Hono()
    .get('/users/:id', (c) => c.json({ id: c.req.param('id') }))
    .post('/users', vValidator('json', schema), (c) => {
      const data = c.req.valid('json')
      return c.json({ created: data }, 201)
    })

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
            output: FailedResponseOutput<typeof schema>
            outputFormat: 'json'
            status: 400
          }
    }
  }

  it('infers validator failures only for the current path', () => {
    type verify = Expect<Equal<Expected, Actual>>
  })
})

describe('With Hook', () => {
  const app = new Hono()

  const schema = v.object({
    id: v.number(),
    title: v.string(),
  })

  app.post(
    '/post',
    vValidator('json', schema, (result, c) => {
      if (!result.success) {
        return c.text('Invalid!', 400)
      }
      const data = result.output
      return c.text(`${data.id} is valid!`)
    }),
    (c) => {
      const data = c.req.valid('json')
      return c.json({
        success: true,
        message: `${data.id} is ${data.title}`,
      })
    }
  )

  it('Should return 200 response', async () => {
    const req = new Request('http://localhost/post', {
      body: JSON.stringify({
        id: 123,
        title: 'Hello',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
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
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    })
    const res = await app.request(req)
    expect(res).not.toBeNull()
    expect(res.status).toBe(400)
  })
})

describe('With Hook Returning Undefined', () => {
  const schema = v.object({
    id: v.number(),
    title: v.string(),
  })

  const app = new Hono().post(
    '/post',
    vValidator('json', schema, (result, c) => {
      if (!result.success && result.typed && result.output.id === 123) {
        return c.text(`${result.output.id} is invalid!`, 400)
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
            output: '123 is invalid!'
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
            output: FailedResponseOutput<typeof schema>
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

  type verify = Expect<Equal<Expected, Actual>>

  it('Should return default 400 response when hook returns undefined', async () => {
    const req = new Request('http://localhost/post', {
      body: JSON.stringify({
        id: 'abc',
        title: 'Hello',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    })
    const res = await app.request(req)
    expect(res).not.toBeNull()
    expect(res.status).toBe(400)
    const data = (await res.json()) as { success: boolean }
    expect(data['success']).toBe(false)
  })
})

describe('Async', () => {
  const app = new Hono()

  const schemaAsync = v.objectAsync({
    name: v.string(),
    age: v.number(),
  })

  const querySchemaAsync = v.optionalAsync(
    v.objectAsync({
      search: v.optionalAsync(v.string()),
      page: v.optionalAsync(v.number()),
    })
  )

  const route = app.post(
    '/author',
    vValidator('json', schemaAsync),
    vValidator('query', querySchemaAsync),
    (c) => {
      const data = c.req.valid('json')
      const query = c.req.valid('query')

      return c.json(
        {
          success: true,
          message: `${data.name} is ${data.age}, search is ${query?.search}`,
        },
        200
      )
    }
  )

  type Actual = ExtractSchema<typeof route>
  type Expected = {
    '/author': {
      $post:
        | {
            input: {
              json: {
                name: string
                age: number
              }
            } & {
              query?:
                | {
                    search?: string | string[] | undefined
                    page?: string | string[] | undefined
                  }
                | undefined
            }
            output: {
              success: true
              message: string
            }
            outputFormat: 'json'
            status: 200
          }
        | {
            input: {
              json: {
                name: string
                age: number
              }
            } & {
              query?:
                | {
                    search?: string | string[] | undefined
                    page?: string | string[] | undefined
                  }
                | undefined
            }
            output:
              | {
                  readonly typed: true
                  readonly success: false
                  readonly output: {
                    name: string
                    age: number
                  }
                  readonly issues: [
                    InferIssue<typeof schemaAsync>,
                    ...InferIssue<typeof schemaAsync>[],
                  ]
                }
              | {
                  readonly typed: false
                  readonly success: false
                  readonly output: unknown
                  readonly issues: [
                    InferIssue<typeof schemaAsync>,
                    ...InferIssue<typeof schemaAsync>[],
                  ]
                }
            outputFormat: 'json'
            status: 400
          }
        | {
            input: {
              json: {
                name: string
                age: number
              }
            } & {
              query?:
                | {
                    search?: string | string[] | undefined
                    page?: string | string[] | undefined
                  }
                | undefined
            }
            output:
              | {
                  readonly typed: true
                  readonly success: false
                  readonly output:
                    | {
                        search?: string | undefined
                        page?: number | undefined
                      }
                    | undefined
                  readonly issues: [
                    InferIssue<typeof querySchemaAsync>,
                    ...InferIssue<typeof querySchemaAsync>[],
                  ]
                }
              | {
                  readonly typed: false
                  readonly success: false
                  readonly output: unknown
                  readonly issues: [
                    InferIssue<typeof querySchemaAsync>,
                    ...InferIssue<typeof querySchemaAsync>[],
                  ]
                }
            outputFormat: 'json'
            status: 400
          }
    }
  }

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore this is a very complex type test
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type verify = Expect<Equal<Expected, Actual>>

  it('Should return 200 response', async () => {
    const req = new Request('http://localhost/author?search=hello', {
      body: JSON.stringify({
        name: 'Superman',
        age: 20,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    })
    const res = await app.request(req)
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      success: true,
      message: 'Superman is 20, search is hello',
    })
  })

  it('Should return 400 response', async () => {
    const req = new Request('http://localhost/author', {
      body: JSON.stringify({
        name: 'Superman',
        age: '20',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    })
    const res = await app.request(req)
    expect(res).not.toBeNull()
    expect(res.status).toBe(400)
    const data = (await res.json()) as { success: boolean }
    expect(data['success']).toBe(false)
  })
})

describe('With Hook Async', () => {
  const app = new Hono()

  const schemaAsync = v.objectAsync({
    id: v.number(),
    title: v.string(),
  })

  app.post(
    '/post',
    vValidator('json', schemaAsync, (result, c) => {
      if (!result.success) {
        return c.text('Invalid!', 400)
      }
      const data = result.output
      return c.text(`${data.id} is valid!`)
    }),
    (c) => {
      const data = c.req.valid('json')
      return c.json({
        success: true,
        message: `${data.id} is ${data.title}`,
      })
    }
  )

  it('Should return 200 response', async () => {
    const req = new Request('http://localhost/post', {
      body: JSON.stringify({
        id: 123,
        title: 'Hello',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
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
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    })
    const res = await app.request(req)
    expect(res).not.toBeNull()
    expect(res.status).toBe(400)
  })
})

describe('Test types', () => {
  describe('all validation targets', () => {
    const jsonSchema = v.object({ jsonName: v.string() })
    const formSchema = v.object({ formName: v.string() })
    const querySchema = v.object({ q: v.string() })
    const paramSchema = v.object({ id: v.string() })
    const headerSchema = v.object({ authorization: v.string() })
    const cookieSchema = v.object({ session: v.string() })

    it('infers json input and failure response', () => {
      const route = new Hono().post('/json', vValidator('json', jsonSchema), (c) => {
        const data = c.req.valid('json')
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
        Equal<FailedResponseOutput<typeof jsonSchema>, (Actual & { status: 400 })['output']>
      >
    })

    it('infers form input and failure response', () => {
      const route = new Hono().post('/form', vValidator('form', formSchema), (c) => {
        const data = c.req.valid('form')
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
        Equal<FailedResponseOutput<typeof formSchema>, (Actual & { status: 400 })['output']>
      >
    })

    it('infers query input and failure response', () => {
      const route = new Hono().get('/query', vValidator('query', querySchema), (c) => {
        const data = c.req.valid('query')
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
        Equal<FailedResponseOutput<typeof querySchema>, (Actual & { status: 400 })['output']>
      >
    })

    it('infers param input and failure response', () => {
      const route = new Hono().get('/param/:id', vValidator('param', paramSchema), (c) => {
        const data = c.req.valid('param')
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
        Equal<FailedResponseOutput<typeof paramSchema>, (Actual & { status: 400 })['output']>
      >
    })

    it('infers header input and failure response', () => {
      const route = new Hono().get('/header', vValidator('header', headerSchema), (c) => {
        const data = c.req.valid('header')
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
        Equal<FailedResponseOutput<typeof headerSchema>, (Actual & { status: 400 })['output']>
      >
    })

    it('infers cookie input and failure response', () => {
      const route = new Hono().get('/cookie', vValidator('cookie', cookieSchema), (c) => {
        const data = c.req.valid('cookie')
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
        Equal<FailedResponseOutput<typeof cookieSchema>, (Actual & { status: 400 })['output']>
      >
    })

    it('infers composed inputs and all failure responses', () => {
      const route = new Hono().post(
        '/all/:id',
        vValidator('param', paramSchema),
        vValidator('query', querySchema),
        vValidator('header', headerSchema),
        vValidator('cookie', cookieSchema),
        vValidator('json', jsonSchema),
        vValidator('form', formSchema),
        (c) => {
          const param = c.req.valid('param')
          const query = c.req.valid('query')
          const header = c.req.valid('header')
          const cookie = c.req.valid('cookie')
          const json = c.req.valid('json')
          const form = c.req.valid('form')

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
        | FailedResponseOutput<typeof paramSchema>
        | FailedResponseOutput<typeof querySchema>
        | FailedResponseOutput<typeof headerSchema>
        | FailedResponseOutput<typeof cookieSchema>
        | FailedResponseOutput<typeof jsonSchema>
        | FailedResponseOutput<typeof formSchema>

      type verifySuccessInput = Expect<
        Equal<ExpectedInput, MergeDiscriminatedUnion<(Actual & { status: 201 })['input']>>
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
        Equal<ExpectedInput, MergeDiscriminatedUnion<(Actual & { status: 400 })['input']>>
      >
      type verifyFailureOutput = Expect<
        Equal<ExpectedFailure, (Actual & { status: 400 })['output']>
      >
    })
  })

  it('Should return correct types when validating a query', () => {
    const app = new Hono()

    const routes = app.post(
      '/',
      vValidator(
        'query',
        v.object({
          foo: v.string(),
        })
      ),
      (c) => {
        return c.json(c.req.valid('query'))
      }
    )

    type T = ExtractSchema<typeof routes>

    type Actual = T['/']['$post']['input']['query']
    type Expected = { foo: string }
    type verify = Expect<Equal<Expected, Actual>>
  })
})
