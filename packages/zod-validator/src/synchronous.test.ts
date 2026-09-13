import { Hono } from 'hono'
import { expectTypeOf } from 'vitest'
import { z } from 'zod/v4'
import { zValidator } from '.'

describe('Synchronous validation', () => {
  const schema = z.object({
    name: z.string().transform((value) => value.toUpperCase()),
    age: z.coerce.number(),
    role: z.literal('reader').default('reader'),
  })
  const app = new Hono()
    .post('/default', zValidator('json', schema), (c) => c.json(c.req.valid('json')))
    .post(
      '/sync',
      zValidator('json', schema, undefined, {
        validationFunction: (schema, value) => schema.safeParse(value),
      }),
      (c) => {
        const data = c.req.valid('json')
        expectTypeOf(data).toEqualTypeOf<{ name: string; age: number; role: 'reader' }>()
        return c.json(data)
      }
    )

  it('Preserves transforms, coercion, defaults, and unknown-key stripping', async () => {
    const request = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Superman', age: '20', extra: true }),
    }
    const baseline = await app.request('/default', request)
    const response = await app.request('/sync', request)

    expect(response.status).toBe(200)
    const data: unknown = await response.json()
    expect(data).toEqual({ name: 'SUPERMAN', age: 20, role: 'reader' })
    expect(data).toEqual(await baseline.json())
  })

  it('Returns the same detailed failure response as the default parser', async () => {
    const request = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 42, age: 'invalid' }),
    }
    const baseline = await app.request('/default', request)
    const response = await app.request('/sync', request)

    expect(response.status).toBe(400)
    const data: unknown = await response.json()
    expect(data).toEqual(await baseline.json())
    expect(data).toMatchObject({ success: false, error: { name: 'ZodError' } })
  })
})
