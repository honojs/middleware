import { Validator } from 'ata-validator'
import type { ValidationError } from 'ata-validator'
import { Hono } from 'hono'
import type { ExtractSchema } from 'hono/types'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type { Equal, Expect } from 'hono/utils/types'
import { ataValidator } from '.'

describe('Basic', () => {
  const app = new Hono()

  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      age: { type: 'number' },
    },
    required: ['name', 'age'],
    additionalProperties: false,
  } as const

  const _route = app.post('/author', ataValidator('json', schema), (c) => {
    const data = c.req.valid('json')
    return c.json({
      success: true,
      message: `${data.name} is ${data.age}`,
    })
  })

  type Actual = ExtractSchema<typeof _route>
  // The route answers the handler's response, or the middleware's 400 with
  // the error list when validation fails.
  type Expected = {
    '/author': {
      $post:
        | {
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
        | {
            input: {
              json: {
                name: string
                age: number
              }
            }
            output: {
              success: false
              errors: ValidationError[]
            }
            outputFormat: 'json'
            status: 400
          }
    }
  }

  type _verify = Expect<Equal<Expected, Actual>>

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

  it('Should return 400 response with the error list', async () => {
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
    const data = (await res.json()) as {
      success: boolean
      errors: { keyword: string; instancePath: string; schemaPath: string; message: string }[]
    }
    expect(data.success).toBe(false)
    expect(data.errors).toHaveLength(1)
    expect(data.errors[0]).toEqual({
      keyword: 'type',
      instancePath: '/age',
      schemaPath: '#/properties/age/type',
      params: { type: 'number' },
      message: 'must be number',
    })
  })
})

describe('With Hook', () => {
  const app = new Hono()

  const schema = {
    type: 'object',
    properties: {
      id: { type: 'number' },
      title: { type: 'string' },
    },
    required: ['id', 'title'],
    additionalProperties: false,
  } as const

  app
    .post(
      '/post',
      ataValidator('json', schema, (result, c) => {
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
      '/errors',
      ataValidator('json', schema, (result, c) => {
        if (!result.success) {
          return c.json({ errors: result.errors.map((e) => e.params['missingProperty']) }, 400)
        }
        return undefined
      }),
      (c) => {
        return c.json(c.req.valid('json'))
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
    expect(await res.text()).toBe('Invalid!')
  })

  it('Should hand the error list to the hook', async () => {
    const req = new Request('http://localhost/errors', {
      body: JSON.stringify({ id: 1 }),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    const res = await app.request(req)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ errors: ['title'] })
  })
})

describe('With a prepared validator', () => {
  const app = new Hono()

  const page = new Validator(
    {
      type: 'object',
      properties: {
        page: { type: 'integer', minimum: 1, default: 1 },
        tag: { type: 'string' },
      },
      required: ['tag'],
    } as const,
    { coerceTypes: true, useDefaults: true }
  )

  const _route = app.get('/posts', ataValidator('query', page), (c) => {
    const { page, tag } = c.req.valid('query')
    return c.json({ page, tag, type: typeof page })
  })

  type Actual = ExtractSchema<typeof _route>['/posts']['$get']['input']['query']
  type _verify = Expect<Equal<{ page?: number; tag: string }, Actual>>

  it('Should coerce and fill in defaults before the handler sees the value', async () => {
    const res = await app.request('http://localhost/posts?page=3&tag=hono')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ page: 3, tag: 'hono', type: 'number' })

    const defaulted = await app.request('http://localhost/posts?tag=hono')
    expect(await defaulted.json()).toEqual({ page: 1, tag: 'hono', type: 'number' })
  })

  it('Should reject a value the schema refuses after coercion', async () => {
    const res = await app.request('http://localhost/posts?page=0&tag=hono')
    expect(res.status).toBe(400)
    const data = (await res.json()) as { errors: { instancePath: string; code?: string }[] }
    expect(data.errors[0]?.instancePath).toBe('/page')
    // a prepared validator reports its own shape, rich by default
    expect(data.errors[0]?.code).toBe('ATA2003')
  })
})

describe('Where dynamic code is refused', () => {
  it('Should validate with Function replaced, the way a strict CSP refuses it', async () => {
    const F = globalThis.Function
    globalThis.Function = function () {
      throw new EvalError('dynamic code is refused here')
    } as unknown as FunctionConstructor
    try {
      const app = new Hono()
      app.post(
        '/n',
        ataValidator('json', {
          type: 'object',
          properties: { n: { type: 'integer', maximum: 3 } },
          required: ['n'],
        } as const),
        (c) => c.json(c.req.valid('json'))
      )
      const ok = await app.request('http://localhost/n', {
        method: 'POST',
        body: JSON.stringify({ n: 2 }),
        headers: { 'Content-Type': 'application/json' },
      })
      expect(ok.status).toBe(200)
      const bad = await app.request('http://localhost/n', {
        method: 'POST',
        body: JSON.stringify({ n: 4 }),
        headers: { 'Content-Type': 'application/json' },
      })
      expect(bad.status).toBe(400)
    } finally {
      globalThis.Function = F
    }
  })
})
