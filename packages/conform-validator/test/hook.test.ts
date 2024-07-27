import * as z from 'zod'
import { Hono } from 'hono'
import { hc } from 'hono/client'
import { parseWithZod } from '@conform-to/zod'
import { conformValidator } from '../src'
import { vi } from 'vitest'

describe('Validate the hook option processing', () => {
  const app = new Hono()
  const schema = z.object({ name: z.string() })
  const hookMockFn = vi.fn((submission, c) => {
    if (submission.status !== 'success') {
      return c.json({ success: false, message: 'Bad Request' }, 400)
    }
  })
  const handlerMockFn = vi.fn((c) => {
    const submission = c.req.valid('form')
    const value = submission.value
    return c.json({ success: true, message: `name is ${value.name}` })
  })
  const route = app.post(
    '/author',
    conformValidator((formData) => parseWithZod(formData, { schema }), hookMockFn),
    handlerMockFn
  )
  const client = hc<typeof route>('http://localhost', {
    fetch: (req, init) => {
      return app.request(req, init)
    },
  })

  afterEach(() => {
    hookMockFn.mockClear()
    handlerMockFn.mockClear()
  })

  it('Should called hook function', async () => {
    await client.author.$post({ form: { name: 'Space Cat' } })
    expect(hookMockFn).toHaveBeenCalledTimes(1)
  })

  describe('When the hook return Response', () => {
    it('Should return response that the hook returned', async () => {
      const req = new Request('http://localhost/author', { body: new FormData(), method: 'POST' })
      const res = (await app.request(req)).clone()
      const hookRes = hookMockFn.mock.results[0].value.clone()
      expect(hookMockFn).toHaveReturnedWith(expect.any(Response))
      expect(res.status).toBe(hookRes.status)
      expect(await res.json()).toStrictEqual(await hookRes.json())
    })
  })

  describe('When the hook not return Response', () => {
    it('Should return response that the handler function returned', async () => {
      const res = (await client.author.$post({ form: { name: 'Space Cat' } })).clone()
      const handlerRes = handlerMockFn.mock.results[0].value.clone()
      expect(hookMockFn).not.toHaveReturnedWith(expect.any(Response))
      expect(res.status).toBe(handlerRes.status)
      expect(await res.json()).toStrictEqual(await handlerRes.json())
    })
  })
})
