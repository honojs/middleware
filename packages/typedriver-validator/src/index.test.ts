import { type } from 'arktype'
import { Hono } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type { Equal, Expect } from 'hono/utils/types'

import { Type } from 'typebox'
import * as v from 'valibot'
import * as z from 'zod'

import { tdValidator } from '.'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type ExtractSchema<T> = T extends Hono<infer _, infer S> ? S : never

// ------------------------------------------------------------------
// Inference
// ------------------------------------------------------------------
type ExpectedJson<T> = {
  '/vector3': {
    $post: {
      input: {
        json: T
      }
      output: {
        success: boolean
        message: string
      }
      outputFormat: 'json'
      status: ContentfulStatusCode
    }
  }
}
describe('Type Inference', () => {
  // ----------------------------------------------------------------
  // TypeScript
  // ----------------------------------------------------------------
  it('With TypeScript', () => {
    const app = new Hono()
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const route = app.post('/vector3', tdValidator('json', `{ 
      x: number,
      y: number,
      z: number
    }`), (c) => {
      const data = c.req.valid('json')
      return c.json({
        success: true as boolean, // no-narrow
        message: `(${data.x}, ${data.y}, ${data.z})`,
      })
    })
    type A = ExtractSchema<typeof route>
    type B = ExpectedJson<{
      x: number
      y: number
      z: number
    }>
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    type C = Expect<Equal<A, B>>
  })
  // ----------------------------------------------------------------
  // Json Schema
  // ----------------------------------------------------------------
  it('With Json Schema', () => {
    const app = new Hono()
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const route = app.post('/vector3', tdValidator('json', {
      type: 'object',
      required: ['x', 'y', 'z'],
      properties: {
        x: { type: 'number' },
        y: { type: 'number' },
        z: { type: 'number' }
      }
    }), (c) => {
      const data = c.req.valid('json')
      return c.json({
        success: true as boolean, // no-narrow
        message: `(${data.x}, ${data.y}, ${data.z})`,
      })
    })
    type A = ExtractSchema<typeof route>
    type B = ExpectedJson<{
      x: number
      y: number
      z: number
    }>
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    type C = Expect<Equal<A, B>>
  })
  // ----------------------------------------------------------------
  // TypeBox
  // ----------------------------------------------------------------
  it('With TypeBox', () => {
    const app = new Hono()
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const route = app.post('/vector3', tdValidator('json', Type.Object({
      x: Type.Number(),
      y: Type.Number(),
      z: Type.Number()
    })), (c) => {
      const data = c.req.valid('json')
      return c.json({
        success: true as boolean, // no-narrow
        message: `(${data.x}, ${data.y}, ${data.z})`,
      })
    })
    type A = ExtractSchema<typeof route>
    type B = ExpectedJson<{
      x: number
      y: number
      z: number
    }>
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    type C = Expect<Equal<A, B>>
  })
  // ----------------------------------------------------------------
  // Zod
  // ----------------------------------------------------------------
  it('With Zod', () => {
    const app = new Hono()
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const route = app.post('/vector3', tdValidator('json', z.object({
      x: z.number(),
      y: z.number(),
      z: z.number()
    })), (c) => {
      const data = c.req.valid('json')
      return c.json({
        success: true as boolean, // no-narrow
        message: `(${data.x}, ${data.y}, ${data.z})`,
      })
    })
    type A = ExtractSchema<typeof route>
    type B = ExpectedJson<{
      x: number
      y: number
      z: number
    }>
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    type C = Expect<Equal<A, B>>
  })
  // ----------------------------------------------------------------
  // Valibot
  // ----------------------------------------------------------------
  it('With Valibot', () => {
    const app = new Hono()
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const route = app.post('/vector3', tdValidator('json', v.object({
      x: v.number(),
      y: v.number(),
      z: v.number()
    })), (c) => {
      const data = c.req.valid('json')
      return c.json({
        success: true as boolean, // no-narrow
        message: `(${data.x}, ${data.y}, ${data.z})`,
      })
    })
    type A = ExtractSchema<typeof route>
    type B = ExpectedJson<{
      x: number
      y: number
      z: number
    }>
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    type C = Expect<Equal<A, B>>
  })
  // ----------------------------------------------------------------
  // ArkType
  // ----------------------------------------------------------------
  it('With ArkType', () => {
    const app = new Hono()
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const route = app.post('/vector3', tdValidator('json', type({
      x: 'number',
      y: 'number',
      z: 'number'
    })), (c) => {
      const data = c.req.valid('json')
      return c.json({
        success: true as boolean, // no-narrow
        message: `(${data.x}, ${data.y}, ${data.z})`,
      })
    })
    type A = ExtractSchema<typeof route>
    type B = ExpectedJson<{
      x: number
      y: number
      z: number
    }>
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    type C = Expect<Equal<A, B>>
  })
  // ----------------------------------------------------------------
  // Unknown
  // ----------------------------------------------------------------
  it('With Unknown', () => {
    const app = new Hono()
    const schema: object = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
      required: ['name', 'age'],
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const route = app.post('/vector3', tdValidator('json', schema), (c) => {
      return c.json({
        success: true as boolean, // no-narrow
        message: `non-schema should infer as unknown`,
      })
    })
    type Actual = ExtractSchema<typeof route>
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    type Result = Expect<Equal<Actual, ExpectedJson<unknown>>>
  })
})
// ------------------------------------------------------------------
// Validate: TypeScript
// ------------------------------------------------------------------
describe('Validate With TypeScript', () => {
  const app = new Hono()
  app.post('/vector3', tdValidator('json', `{
    x: number
    y: number
    z: number  
  }`), (c) => {
    const data = c.req.valid('json')
    return c.json({
      success: true,
      message: `(${data.x}, ${data.y}, ${data.z})`,
    })
  })
  it('Should return 200 response', async () => {
    const req = new Request('http://localhost/vector3', {
      body: JSON.stringify({ x: 1, y: 2, z: 3 }),
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
      message: '(1, 2, 3)',
    })
  })
  it('Should return 400 response', async () => {
    const req = new Request('http://localhost/vector3', {
      body: JSON.stringify({ x: 'not-a-vector3' }),
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
// Validate: TypeBox
// ------------------------------------------------------------------
describe('Validate With TypeBox', () => {
  const app = new Hono()
  app.post('/vector3', tdValidator('json', Type.Object({
    x: Type.Number(),
    y: Type.Number(),
    z: Type.Number()
  })), (c) => {
    const data = c.req.valid('json')
    return c.json({
      success: true,
      message: `(${data.x}, ${data.y}, ${data.z})`,
    })
  })
  it('Should return 200 response', async () => {
    const req = new Request('http://localhost/vector3', {
      body: JSON.stringify({ x: 1, y: 2, z: 3 }),
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
      message: '(1, 2, 3)',
    })
  })
  it('Should return 400 response', async () => {
    const req = new Request('http://localhost/vector3', {
      body: JSON.stringify({ x: 'not-a-vector3' }),
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
// Validate: JsonSchema
// ------------------------------------------------------------------
describe('Validate With JsonSchema', () => {
  const app = new Hono()
  app.post('/vector3', tdValidator('json', {
    type: 'object',
    required: ['x', 'y', 'z'],
    properties: {
      x: { type: 'number' },
      y: { type: 'number' },
      z: { type: 'number' }
    }
  }), (c) => {
    const data = c.req.valid('json')
    return c.json({
      success: true,
      message: `(${data.x}, ${data.y}, ${data.z})`,
    })
  })
  it('Should return 200 response', async () => {
    const req = new Request('http://localhost/vector3', {
      body: JSON.stringify({ x: 1, y: 2, z: 3 }),
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
      message: '(1, 2, 3)',
    })
  })
  it('Should return 400 response', async () => {
    const req = new Request('http://localhost/vector3', {
      body: JSON.stringify({ x: 'not-a-vector3' }),
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
// Validate: Zod
// ------------------------------------------------------------------
describe('Validate With Zod', () => {
  const app = new Hono()
  app.post('/vector3', tdValidator('json', z.object({
    x: z.number(),
    y: z.number(),
    z: z.number()
  })), (c) => {
    const data = c.req.valid('json')
    return c.json({
      success: true,
      message: `(${data.x}, ${data.y}, ${data.z})`,
    })
  })
  it('Should return 200 response', async () => {
    const req = new Request('http://localhost/vector3', {
      body: JSON.stringify({ x: 1, y: 2, z: 3 }),
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
      message: '(1, 2, 3)',
    })
  })
  it('Should return 400 response', async () => {
    const req = new Request('http://localhost/vector3', {
      body: JSON.stringify({ x: 'not-a-vector3' }),
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
// Validate: Valibot
// ------------------------------------------------------------------
describe('Validate With Valibot', () => {
  const app = new Hono()
  app.post('/vector3', tdValidator('json', v.object({
    x: v.number(),
    y: v.number(),
    z: v.number()
  })), (c) => {
    const data = c.req.valid('json')
    return c.json({
      success: true,
      message: `(${data.x}, ${data.y}, ${data.z})`,
    })
  })
  it('Should return 200 response', async () => {
    const req = new Request('http://localhost/vector3', {
      body: JSON.stringify({ x: 1, y: 2, z: 3 }),
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
      message: '(1, 2, 3)',
    })
  })
  it('Should return 400 response', async () => {
    const req = new Request('http://localhost/vector3', {
      body: JSON.stringify({ x: 'not-a-vector3' }),
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
// Validate: ArkType
// ------------------------------------------------------------------
describe('Validate With ArkType', () => {
  const app = new Hono()
  app.post('/vector3', tdValidator('json', type({
    x: 'number',
    y: 'number',
    z: 'number'
  })), (c) => {
    const data = c.req.valid('json')
    return c.json({
      success: true,
      message: `(${data.x}, ${data.y}, ${data.z})`,
    })
  })
  it('Should return 200 response', async () => {
    const req = new Request('http://localhost/vector3', {
      body: JSON.stringify({ x: 1, y: 2, z: 3 }),
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
      message: '(1, 2, 3)',
    })
  })
  it('Should return 400 response', async () => {
    const req = new Request('http://localhost/vector3', {
      body: JSON.stringify({ x: 'not-a-vector3' }),
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
  const schema = `{ id: number, title: string }`
  app
    .post(
      '/post',
      tdValidator('json', schema, (result, c) => {
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
      tdValidator('json', schema, (result, c) => {
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

  it('Should return 400 response and error array (Json Schema Format)', async () => {
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

    const { errors, success } = (await res.json()) as { success: boolean; errors: unknown }
    expect(success).toBe(false)
    expect(Array.isArray(errors)).toBe(true)
    expect(errors).toEqual([
      {
        keyword: 'required',
        schemaPath: '#',
        instancePath: '',
        params: { requiredProperties: ['title'] },
        message: 'must have required properties title',
      },
    ])
  })
})
