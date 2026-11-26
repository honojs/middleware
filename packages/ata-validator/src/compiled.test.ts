import { Validator } from 'ata-validator'
import type { JSONSchema } from 'ata-validator'
import { toStandaloneModule } from 'ata-validator/build'
import { Hono } from 'hono'
import type { ExtractSchema } from 'hono/types'
import type { Equal, Expect } from 'hono/utils/types'
import { ataCompiled } from './compiled'
import type { CompiledValidator } from './compiled'

// A module as `ata build` writes it, loaded without touching the file system.
async function compile<T>(schema: JSONSchema) {
  const source = toStandaloneModule(new Validator(schema, { richErrors: false }), {
    format: 'esm',
  })
  if (source === null) {
    throw new Error('the schema did not compile')
  }
  if (source.includes("from '") || source.includes('require(')) {
    throw new Error('a compiled module must import nothing')
  }
  return (await import(
    'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
  )) as CompiledValidator<T>
}

type User = { name: string; age: number }

function authorRoute(compiled: CompiledValidator<User>) {
  const app = new Hono()
  const _route = app.post('/author', ataCompiled('json', compiled), (c) => {
    const data = c.req.valid('json')
    return c.json({ success: true, message: `${data.name} is ${data.age}` })
  })
  type Actual = ExtractSchema<typeof _route>['/author']['$post']['input']
  type _verify = Expect<Equal<{ json: User }, Actual>>
  return app
}

describe('Compiled module', () => {
  let app: Hono
  beforeAll(async () => {
    app = authorRoute(
      await compile<User>({
        type: 'object',
        properties: { name: { type: 'string' }, age: { type: 'number' } },
        required: ['name', 'age'],
        additionalProperties: false,
      })
    )
  })

  it('Should return 200 response', async () => {
    const res = await app.request('http://localhost/author', {
      method: 'POST',
      body: JSON.stringify({ name: 'Superman', age: 20 }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, message: 'Superman is 20' })
  })

  it('Should return 400 response with the error list', async () => {
    const res = await app.request('http://localhost/author', {
      method: 'POST',
      body: JSON.stringify({ name: 'Superman', age: '20' }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status).toBe(400)
    const data = (await res.json()) as {
      success: boolean
      errors: { keyword: string; instancePath: string }[]
    }
    expect(data.success).toBe(false)
    expect(data.errors).toHaveLength(1)
    expect(data.errors[0]).toMatchObject({ keyword: 'type', instancePath: '/age' })
  })
})

describe('Compiled module with hook', () => {
  const app = new Hono()
  it('Should hand the result to the hook', async () => {
    const compiled = await compile<{ id: number }>({
      type: 'object',
      properties: { id: { type: 'number' } },
      required: ['id'],
    })
    app.post(
      '/post',
      ataCompiled('json', compiled, (result, c) => {
        if (!result.success) {
          return c.text('Invalid!', 400)
        }
        return c.text(`${result.data.id} is valid!`)
      }),
      (c) => c.json(c.req.valid('json'))
    )
    const ok = await app.request('http://localhost/post', {
      method: 'POST',
      body: JSON.stringify({ id: 123 }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(await ok.text()).toBe('123 is valid!')
    const bad = await app.request('http://localhost/post', {
      method: 'POST',
      body: JSON.stringify({ id: '123' }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(bad.status).toBe(400)
    expect(await bad.text()).toBe('Invalid!')
  })
})

describe('Compiled module where dynamic code is refused', () => {
  it('Should validate with Function replaced, the way a strict CSP refuses it', async () => {
    const compiled = await compile<{ n: number }>({
      type: 'object',
      properties: { n: { type: 'integer', maximum: 3 } },
      required: ['n'],
    })
    const F = globalThis.Function
    globalThis.Function = function () {
      throw new EvalError('dynamic code is refused here')
    } as unknown as FunctionConstructor
    try {
      const app = new Hono()
      app.post('/n', ataCompiled('json', compiled), (c) => c.json(c.req.valid('json')))
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
