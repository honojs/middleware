import { parseWithZod } from '@conform-to/zod'
import { Hono } from 'hono'
import { z } from 'zod'
import { conformValidator } from '../src'

describe('Validate common processing', () => {
  const app = new Hono()
  const schema = z.object({ name: z.string() })
  const route = app.post(
    '/author',
    conformValidator((formData) => parseWithZod(formData, { schema })),
    (c) => {
      const submission = c.req.valid('form')
      const value = submission.value
      return c.json({ success: true, message: `my name is ${value.name}` })
    }
  )

  describe('When the request body is empty', () => {
    it('Should return 400 response', async () => {
      const res = await route.request('/author', { method: 'POST' })
      expect(res.status).toBe(400)
    })
  })

  describe('When the request body is not FormData', () => {
    it('Should return 400 response', async () => {
      const res = await route.request('/author', {
        method: 'POST',
        body: JSON.stringify({ name: 'Space Cat!' }),
      })
      expect(res.status).toBe(400)
    })
  })
})
