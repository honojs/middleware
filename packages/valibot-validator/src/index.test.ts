import type { TypedResponse } from 'hono'
import { Hono } from 'hono'
import type { Equal, Expect, UnionToIntersection } from 'hono/utils/types'
import type { InferIssue, NumberIssue, ObjectIssue, StringIssue } from 'valibot'
import { number, object, objectAsync, optional, optionalAsync, string } from 'valibot'
import type { FailedResponse } from '.'
import { vValidator } from '.'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type ExtractSchema<T> = T extends Hono<infer _, infer S> ? S : never
type MergeDiscriminatedUnion<U> =
  UnionToIntersection<U> extends infer O ? { [K in keyof O]: O[K] } : never

describe('Basic', () => {
  const app = new Hono()

  const schema = object({
    name: string(),
    age: number(),
  })

  const querySchema = optional(
    object({
      search: optional(string()),
      page: optional(number()),
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
              search?: string | string[] | undefined
              page?: string | string[] | undefined
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
              search?: string | string[] | undefined
              page?: string | string[] | undefined
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
  type withHook_verifyErrorOutput = Expect<
    Equal<
      | ({
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
        } & { typed: true })
      | 'Invalid query'
      | 'Invalid data',
      (Actual['/with-hook']['$post'] & { status: 400 })['output']
    >
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

describe('With Hook', () => {
  const app = new Hono()

  const schema = object({
    id: number(),
    title: string(),
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

describe('Async', () => {
  const app = new Hono()

  const schemaAsync = objectAsync({
    name: string(),
    age: number(),
  })

  const querySchemaAsync = optionalAsync(
    objectAsync({
      search: optionalAsync(string()),
      page: optionalAsync(number()),
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

  const schemaAsync = objectAsync({
    id: number(),
    title: string(),
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
  it('Should return correct types when validating a query', () => {
    const app = new Hono()

    const routes = app.post(
      '/',
      vValidator(
        'query',
        object({
          foo: string(),
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
