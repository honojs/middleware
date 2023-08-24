import { Hono } from 'hono'
import type { Equal, Expect } from 'hono/utils/types'
import { z } from 'zod'
import { zValidator } from '../src'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type ExtractSchema<T> = T extends Hono<infer _, infer S> ? S : never

describe('Basic', () => {
  const app = new Hono()

  const schema = z.object({
    name: z.string(),
    age: z.number(),
  })

  const route = app.post('/author', zValidator('json', schema), (c) => {
    const data = c.req.valid('json')
    return c.jsonT({
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

  const schema = z.object({
    id: z.number(),
    title: z.string(),
  })

  app.post(
    '/post',
    zValidator('json', schema, (result, c) => {
      if (!result.success) {
        return c.text(`${result.data.id} is invalid!`, 400)
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

  it('Should return 200 response', async () => {
    const req = new Request('http://localhost/post', {
      body: JSON.stringify({
        id: 123,
        title: 'Hello',
      }),
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
      method: 'POST',
    })
    const res = await app.request(req)
    expect(res).not.toBeNull()
    expect(res.status).toBe(400)
    expect(await res.text()).toBe('123 is invalid!')
  })
})
