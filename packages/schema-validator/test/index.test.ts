import { Hono } from 'hono'
import type { Equal, Expect } from 'hono/utils/types'
import { Schema as S } from '@effect/schema'
import { schemaValidator } from '../src'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type ExtractSchema<T> = T extends Hono<infer _, infer S> ? S : never

describe('Basic', () => {
  const app = new Hono()

  const jsonSchema = S.Struct({
    name: S.String,
    age: S.Number
  })

  const querySchema = S.Struct({
    name: S.optional(S.String)
  })

  const route = app.post(
    '/author',
    schemaValidator('json', jsonSchema),
    schemaValidator('query', querySchema),
    (c) => {
      const data = c.req.valid('json') as S.Schema.Type<typeof jsonSchema>
      const query = c.req.valid('query') as S.Schema.Type<typeof querySchema>

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
            name?: string | string[] | undefined
          }
          | undefined
        }
        output: {
          success: boolean
          message: string
          queryName: string | undefined
        }
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
    expect(data.success).toBe(false)
  })
})

describe('coerce', () => {
  const app = new Hono()

  const querySchema = S.Struct({
    page: S.NumberFromString
  })


  const route = app.get('/page', schemaValidator('query', querySchema), (c) => {
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
})

