import { Hono } from 'hono'
import type { Equal, Expect } from 'hono/utils/types'
import { number, object, objectAsync, optional, optionalAsync, string } from 'valibot'
import { vValidator } from '../src'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type ExtractSchema<T> = T extends Hono<infer _, infer S> ? S : never

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

  const route = app.post(
    '/author',
    vValidator('json', schema),
    vValidator('query', querySchema),
    (c) => {
      const data = c.req.valid('json')
      const query = c.req.valid('query')

      return c.json({
        success: true,
        message: `${data.name} is ${data.age}, search is ${query?.search}`,
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
                search?: string | string[] | undefined
                page?: string | string[] | undefined
              }
            | undefined
        }
        output: {
          success: boolean
          message: string
        }
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

      return c.json({
        success: true,
        message: `${data.name} is ${data.age}, search is ${query?.search}`,
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
                search?: string | string[] | undefined
                page?: string | string[] | undefined
              }
            | undefined
        }
        output: {
          success: boolean
          message: string
        }
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
