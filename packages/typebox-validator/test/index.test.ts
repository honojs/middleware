import { Type as T, TypeBoxError } from '@sinclair/typebox'
import { Hono } from 'hono'
import type { Equal, Expect } from 'hono/utils/types'
import { tbValidator } from '../src'
import { ValueError } from '@sinclair/typebox/value'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type ExtractSchema<T> = T extends Hono<infer _, infer S> ? S : never

describe('Basic', () => {
  const app = new Hono()

  const schema = T.Object({
    name: T.String(),
    age: T.Number(),
  })

  const route = app.post('/author', tbValidator('json', schema), (c) => {
    const data = c.req.valid('json')
    return c.json({
      success: true,
      message: `${data.name} is ${data.age}`,
    })
  })

  type Actual = ExtractSchema<typeof route>
  type Expected = {
    '/author': {
      $post: {
        input: {
          json: {
            name: string
            age: number
          }
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
    const req = new Request('http://localhost/author', {
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

describe('With Hook', () => {
  const app = new Hono()

  const schema = T.Object({
    id: T.Number(),
    title: T.String(),
  })

  app
    .post(
      '/post',
      tbValidator('json', schema, (result, c) => {
        if (!result.success) {
          return c.text('Invalid!', 400)
        }
        const data = result.data
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
    .post(
      '/errorTest',
      tbValidator('json', schema, (result, c) => {
        return c.json(result, 400)
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
  })

  it('Should return 400 response and error array', async () => {
    const req = new Request('http://localhost/errorTest', {
      body: JSON.stringify({
        id: 123,
      }),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    const res = await app.request(req)
    expect(res).not.toBeNull()
    expect(res.status).toBe(400)

    const { errors, success } = (await res.json()) as { success: boolean; errors: any[] }
    expect(success).toBe(false)
    expect(Array.isArray(errors)).toBe(true)
    expect(
      errors.map((e: ValueError) => ({
        type: e?.schema?.type,
        path: e?.path,
        message: e?.message,
      }))
    ).toEqual([
      {
        type: 'string',
        path: '/title',
        message: 'Required property',
      },
      {
        type: 'string',
        path: '/title',
        message: 'Expected string',
      },
    ])
  })
})
