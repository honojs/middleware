import { a } from '@arrirpc/schema'
import { Hono } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type { Equal, Expect } from 'hono/utils/types'
import { vi } from 'vitest'
import { aValidator } from '.'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type ExtractSchema<T> = T extends Hono<infer _, infer S> ? S : never

describe('Basic', () => {
  const app = new Hono()

  const jsonSchema = a.object({
    name: a.string(),
    age: a.number(),
  })

  const querySchema = a.object({
    name: a.optional(a.string()),
  })

  const route = app.post(
    '/author',
    aValidator('json', jsonSchema),
    aValidator('query', querySchema),
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
          query: {
            name?: string | undefined
          }
        }
        output: {
          success: boolean
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

  const querySchema = a.object({
    page: a.number(),
  })

  const route = app.get(
    '/page',
    aValidator('query', querySchema, undefined, {
      validationFunction: async (schema, value) => {
        return a.coerce(schema, value)
      },
    }),
    (c) => {
      const { page } = c.req.valid('query')
      return c.json({ page })
    }
  )

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
})

describe('With Hook', () => {
  const app = new Hono()

  const schema = a.object({
    id: a.number(),
    title: a.string(),
  })

  app.post(
    '/post',
    aValidator('json', schema, (result, c) => {
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

describe('With Async Hook', () => {
  const app = new Hono()

  const schema = a.object({
    id: a.number(),
    title: a.string(),
  })

  app.post(
    '/post',
    aValidator('json', schema, async (result, c) => {
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

    const schema = a.object({
      id: a.string(),
    })

    const jsonHook = vi.fn()
    const paramHook = vi.fn()
    const queryHook = vi.fn()
    app.post(
      '/:id/post',
      aValidator('json', schema, jsonHook),
      aValidator('param', schema, paramHook),
      aValidator('query', schema, queryHook),
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

    const querySchema = a.object({
      order: a.enumerator(['asc', 'desc']),
    })

    const route = app.get('/', aValidator('query', querySchema), (c) => {
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
  it('Should ignore the case for headers in the Arri schema and return 200', () => {
    const app = new Hono()
    const headerSchema = a.object({
      'Content-Type': a.string(),
      ApiKey: a.string(),
      onlylowercase: a.string(),
      ONLYUPPERCASE: a.string(),
    })

    const route = app.get('/', aValidator('header', headerSchema), (c) => {
      const headers = c.req.valid('header')
      return c.json(headers)
    })

    type Actual = ExtractSchema<typeof route>
    type Expected = {
      '/': {
        $get: {
          input: {
            header: a.infer<typeof headerSchema>
          }
          output: a.infer<typeof headerSchema>
          outputFormat: 'json'
          status: ContentfulStatusCode
        }
      }
    }
    type verify = Expect<Equal<Expected, Actual>>
  })
})
