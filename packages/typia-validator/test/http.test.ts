import { Hono } from 'hono'
import type { Equal, Expect } from 'hono/utils/types'
import type { tags } from 'typia'
import typia from 'typia'
import { typiaValidator } from '../src/http'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type ExtractSchema<T> = T extends Hono<infer _, infer S> ? S : never

describe('Basic', () => {
  const app = new Hono()

  interface JsonSchema {
    name: string
    age: number
  }
  const validateJson = typia.createValidate<JsonSchema>()

  interface QuerySchema {
    name?: string
  }
  const validateQuery = typia.http.createValidateQuery<QuerySchema>()
  interface HeaderSchema {
    'x-Category': ('x' | 'y' | 'z')[]
  }
  const validateHeader = typia.http.createValidateHeaders<HeaderSchema>()

  const route = app.post(
    '/author',
    typiaValidator('json', validateJson),
    typiaValidator('query', validateQuery),
    typiaValidator('header', validateHeader),
    (c) => {
      const data = c.req.valid('json')
      const query = c.req.valid('query')
      const header = c.req.valid('header')

      return c.json({
        success: true,
        message: `${data.name} is ${data.age}`,
        queryName: query?.name,
        headerCategory: header['x-Category'],
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
        } & {
          header: {
            'x-Category': 'x' | 'y' | 'z'
          }
        }
        output: {
          success: boolean
          message: string
          queryName: string | undefined
          headerCategory: ('x' | 'y' | 'z')[]
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
        'X-Category': 'x, y, z',
      },
    })
    const res = await app.request(req)
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      success: true,
      message: 'Superman is 20',
      queryName: 'Metallo',
      headerCategory: ['x', 'y', 'z'],
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

describe('transform', () => {
  const app = new Hono()

  interface QuerySchema {
    page: (0 | 1 | 2)[]
  }
  const validateQuery = typia.http.createValidateQuery<QuerySchema>()

  interface HeaderSchema {
    'X-Categories': (0 | 1 | 2)[]
  }
  const validateHeader = typia.http.createValidateHeaders<HeaderSchema>()

  const route = app.get(
    '/page',
    typiaValidator('query', validateQuery),
    typiaValidator('header', validateHeader),
    (c) => {
      const { page } = c.req.valid('query')
      const { 'X-Categories': categories } = c.req.valid('header')
      return c.json({ page, categories })
    }
  )

  type Actual = ExtractSchema<typeof route>
  type Expected = {
    '/page': {
      $get: {
        input: {
          query: {
            page: `${0 | 1 | 2}`[]
          }
        } & {
          header: {
            'X-Categories': `${0 | 1 | 2}`
          }
        }
        output: {
          page: (0 | 1 | 2)[]
          categories: (0 | 1 | 2)[]
        }
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type verify = Expect<Equal<Expected, Actual>>

  it('Should return 200 response', async () => {
    const res = await app.request('/page?page=1', {
      headers: {
        'X-Categories': '0, 1, 2',
      },
    })
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      page: [1],
      categories: [0, 1, 2],
    })
  })
})

describe('With Hook', () => {
  const app = new Hono()

  interface Schema {
    id: number
    title: string
  }
  const validateSchema = typia.createValidate<Schema>()

  app.post(
    '/post',
    typiaValidator('json', validateSchema, (result, c) => {
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

  interface Schema {
    id: number & tags.Maximum<999>
    title: string
  }
  const validateSchema = typia.createValidate<Schema>()
  const validateQuery = typia.http.createValidateQuery<Schema>()
  const validateHeader = typia.http.createValidateHeaders<Schema>()

  app.post(
    '/post',
    typiaValidator('json', validateSchema, async (result, c) => {
      if (!result.success) {
        return c.text(`${result.data.id} is invalid!`, 400)
      }
    }),
    typiaValidator('query', validateQuery, async (result, c) => {
      if (!result.success) {
        return c.text(`${result.data.id} is invalid!`, 400)
      }
    }),
    typiaValidator('header', validateHeader, async (result, c) => {
      if (!result.success) {
        return c.text(`${result.data.id} is invalid!`, 400)
      }
    }),
    (c) => {
      const data = c.req.valid('json')
      const query = c.req.valid('query')
      const header = c.req.valid('header')
      return c.json({ data, query, header })
    }
  )

  it('Should return 200 response', async () => {
    const req = new Request('http://localhost/post?id=125&title=My', {
      body: JSON.stringify({
        id: 123,
        title: 'Hello',
      }),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Id: '124',
        Title: 'World',
      },
    })
    const res = await app.request(req)
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      data: { id: 123, title: 'Hello' },
      query: { id: 125, title: 'My' },
      header: { id: 124, title: 'World' },
    })
  })

  it('Should return 400 response', async () => {
    let req = new Request('http://localhost/post', {
      body: JSON.stringify({
        id: '123',
        title: 'Hello',
      }),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    let res = await app.request(req)
    expect(res).not.toBeNull()
    expect(res.status).toBe(400)
    expect(await res.text()).toBe('123 is invalid!')

    req = new Request('http://localhost/post?id=1000&title=My', {
      body: JSON.stringify({
        id: 123,
        title: 'Hello',
      }),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Id: '124',
        Title: 'World',
      },
    })
    res = await app.request(req)
    expect(res).not.toBeNull()
    expect(res.status).toBe(400)
    expect(await res.text()).toBe('1000 is invalid!')

    req = new Request('http://localhost/post?id=125&title=My', {
      body: JSON.stringify({
        id: 123,
        title: 'Hello',
      }),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Id: '1000',
        Title: 'World',
      },
    })
    res = await app.request(req)
    expect(res).not.toBeNull()
    expect(res.status).toBe(400)
    expect(await res.text()).toBe('1000 is invalid!')
  })
})

describe('With target', () => {
  it('should call hook for correctly validated target', async () => {
    const app = new Hono()

    interface Schema {
      id: number
    }
    const validateSchema = typia.createValidate<Schema>()
    const validateQuery = typia.http.createValidateQuery<Schema>()
    const validateHeader = typia.http.createValidateHeaders<Schema>()

    const jsonHook = vi.fn()
    const headerHook = vi.fn()
    const queryHook = vi.fn()
    app.post(
      '/post',
      typiaValidator('json', validateSchema, jsonHook),
      typiaValidator('query', validateQuery, queryHook),
      typiaValidator('header', validateHeader, headerHook),
      (c) => {
        return c.text('ok')
      }
    )

    const req = new Request('http://localhost/post?id=2', {
      body: JSON.stringify({
        id: 3,
      }),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        id: '1',
      },
    })

    const res = await app.request(req)
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('ok')
    expect(headerHook).toHaveBeenCalledWith({ data: { id: 1 }, success: true }, expect.anything())
    expect(queryHook).toHaveBeenCalledWith({ data: { id: 2 }, success: true }, expect.anything())
    expect(jsonHook).toHaveBeenCalledWith({ data: { id: 3 }, success: true }, expect.anything())
  })
})

describe('Case-Insensitive Headers', () => {
  it('Should ignore the case for headers in the Zod schema and return 200', () => {
    const app = new Hono()
    interface HeaderSchema {
      'Content-Type': string
      ApiKey: string
      onlylowercase: string
      ONLYUPPERCASE: string
    }
    const validateHeader = typia.http.createValidateHeaders<HeaderSchema>()

    const route = app.get('/', typiaValidator('header', validateHeader), (c) => {
      const headers = c.req.valid('header')
      return c.json(headers)
    })

    type Actual = ExtractSchema<typeof route>
    type Expected = {
      '/': {
        $get: {
          input: {
            header: HeaderSchema
          }
          output: HeaderSchema
        }
      }
    }
    type verify = Expect<Equal<Expected, Actual>>
  })
})
