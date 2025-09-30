import { Hono } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type { Equal, Expect } from 'hono/utils/types'

import { Type } from 'typebox'
import * as v from 'valibot'
import { tbValidator } from '.'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type ExtractSchema<T> = T extends Hono<infer _, infer S> ? S : never

// ------------------------------------------------------------------
// Infer: Structure
// ------------------------------------------------------------------
type InferExpect = {
  '/author': {
    $post: {
      input: {
        json: {
          name: string
          age: number
        }
      }
      output: {
        success: true
        message: string
      }
      outputFormat: 'json'
      status: ContentfulStatusCode
    }
  }
}
// ------------------------------------------------------------------
// Infer: TypeBox
// ------------------------------------------------------------------
{
  const app = new Hono()
  const schema = Type.Object({
    name: Type.String(),
    age: Type.Number(),
  })
  const route = app.post('/author', tbValidator('json', schema), (c) => {
    const data = c.req.valid('json')
    return c.json({
      success: true,
      message: `${data.name} is ${data.age}`,
    })
  })
  type Actual = ExtractSchema<typeof route>
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type Result = Expect<Equal<Actual, InferExpect>>
}
// ------------------------------------------------------------------
// Infer: Json Schema
// ------------------------------------------------------------------
{
  const app = new Hono()
  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      age: { type: 'number' },
    },
    required: ['name', 'age'],
  } as const
  const route = app.post('/author', tbValidator('json', schema), (c) => {
    const data = c.req.valid('json')
    return c.json({
      success: true,
      message: `${data.name} is ${data.age}`,
    })
  })
  type Actual = ExtractSchema<typeof route>
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type Result = Expect<Equal<Actual, InferExpect>>
}
// ------------------------------------------------------------------
// Infer: Standard Schema
// ------------------------------------------------------------------
{
  const app = new Hono()
  const schema = v.object({
    name: v.string(),
    age: v.number(),
  })
  const route = app.post('/author', tbValidator('json', schema), (c) => {
    const data = c.req.valid('json')
    return c.json({
      success: true,
      message: `${data.name} is ${data.age}`,
    })
  })
  type Actual = ExtractSchema<typeof route>
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type Result = Expect<Equal<Actual, InferExpect>>
}
// ------------------------------------------------------------------
// Validation: TypeBox
// ------------------------------------------------------------------
describe('With TypeBox', () => {
  const app = new Hono()
  const schema = Type.Object({
    name: Type.String(),
    age: Type.Number(),
  })
  const route = app.post('/author', tbValidator('json', schema), (c) => {
    const data = c.req.valid('json')
    return c.json({
      success: true,
      message: `${data.name} is ${data.age}`,
    })
  })
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
// ------------------------------------------------------------------
// Validation: Json Schema
// ------------------------------------------------------------------
describe('With Json Schema', () => {
  const app = new Hono()
  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      age: { type: 'number' },
    },
    required: ['name', 'age'],
  } as const
  const route = app.post('/author', tbValidator('json', schema), (c) => {
    const data = c.req.valid('json')
    return c.json({
      success: true,
      message: `${data.name} is ${data.age}`,
    })
  })
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
// ------------------------------------------------------------------
// Validation: Standard Schema
// ------------------------------------------------------------------
describe('With Standard Schema', () => {
  const app = new Hono()
  const schema = v.object({
    name: v.string(),
    age: v.number(),
  })
  const route = app.post('/author', tbValidator('json', schema), (c) => {
    const data = c.req.valid('json')
    return c.json({
      success: true,
      message: `${data.name} is ${data.age}`,
    })
  })
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
// ------------------------------------------------------------------
// Hooks
// ------------------------------------------------------------------
describe('With Hook', () => {
  const app = new Hono()

  const schema = Type.Object({
    id: Type.Number(),
    title: Type.String(),
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
    expect(errors).toEqual([
      {
        keyword: 'required',
        schemaPath: '#',
        instancePath: '',
        params: { requiredProperties: [ 'title' ] },
        message: 'must have required properties title'
      }
    ])
  })
})
// ------------------------------------------------------------------
// Clean
// ------------------------------------------------------------------
describe('With Clean', () => {
  const app = new Hono()
  const schema = Type.Object({
    id: Type.Number(),
    title: Type.String(),
  })

  const nestedSchema = Type.Object({
    id: Type.Number(),
    itemArray: Type.Array(schema),
    item: schema,
    itemObject: Type.Object({
      item1: schema,
      item2: schema,
    }),
  })

  app
    .post('/stripValuesNested', tbValidator('json', nestedSchema, undefined, true), (c) => {
      return c.json({
        success: true,
        message: c.req.valid('json'),
      })
    })
    .post('/stripValuesArray', tbValidator('json', Type.Array(schema), undefined, true), (c) => {
      return c.json({
        success: true,
        message: c.req.valid('json'),
      })
    })

  it('Should remove all the values in the nested object and return a 200 response', async () => {
    const req = new Request('http://localhost/stripValuesNested', {
      body: JSON.stringify({
        id: 123,
        nonExistentKey: 'error',
        itemArray: [
          {
            id: 123,
            title: 'Hello',
            nonExistentKey: 'error',
          },
          {
            id: 123,
            title: 'Hello',
            nonExistentKey: 'error',
            nonExistentKey2: 'error 2',
          },
        ],
        item: {
          id: 123,
          title: 'Hello',
          nonExistentKey: 'error',
        },
        itemObject: {
          item1: {
            id: 123,
            title: 'Hello',
            imaginaryKey: 'error',
          },
          item2: {
            id: 123,
            title: 'Hello',
            error: 'error',
          },
        },
      }),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    const res = await app.request(req)
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)

    const { message, success } = (await res.json()) as { success: boolean; message: any }
    expect(success).toBe(true)
    expect(message).toEqual({
      id: 123,
      itemArray: [
        { id: 123, title: 'Hello' },
        {
          id: 123,
          title: 'Hello',
        },
      ],
      item: { id: 123, title: 'Hello' },
      itemObject: {
        item1: { id: 123, title: 'Hello' },
        item2: { id: 123, title: 'Hello' },
      },
    })
  })

  it('Should remove all the values in the array and return a 200 response', async () => {
    const req = new Request('http://localhost/stripValuesArray', {
      body: JSON.stringify([
        {
          id: 123,
          title: 'Hello',
          nonExistentKey: 'error',
        },
        {
          id: 123,
          title: 'Hello 2',
          nonExistentKey: 'error',
        },
      ]),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const res = await app.request(req)
    const { message, success } = (await res.json()) as { success: boolean; message: any[] }
    expect(res.status).toBe(200)
    expect(success).toBe(true)
    expect(message).toEqual([
      { id: 123, title: 'Hello' },
      {
        id: 123,
        title: 'Hello 2',
      },
    ])
  })
})
