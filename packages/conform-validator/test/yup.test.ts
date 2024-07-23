import type { ExtractSchema } from 'hono/types'
import type { Equal, Expect } from 'hono/utils/types'
import * as y from 'yup'
import { Hono } from 'hono'
import { hc } from 'hono/client'
import { HTTPException } from 'hono/http-exception'
import { parseWithYup } from '@conform-to/yup'
import { conformValidator } from '../src'

describe('Validate requests using a Valibot schema', () => {
  const app = new Hono()

  const schema = y.object({
    name: y.string().required(),
    age: y.number().required(),
    nickname: y.string().optional(),
  })

  const route = app.post(
    '/author',
    conformValidator((formData) => parseWithYup(formData, { schema })),
    (c) => {
      const submission = c.req.valid('form')

      if (submission.status === 'success') {
        const value = submission.value

        return c.json({
          success: true,
          message: `${value.name} is ${value.age}, nickname is ${
            value?.nickname || 'nothing yet :3'
          }`,
        })
      }

      const res = c.json({ success: false, message: 'Bad Request' }, 400)
      throw new HTTPException(400, { res })
    }
  )

  it.skip('check the route object types', () => {
    type Actual = ExtractSchema<typeof route>
    type Expected = {
      '/author': {
        $post: {
          input: {
            form: {
              name: string | File
              age: string | File
              nickname?: string | File | undefined
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
  })

  it('Should return 200 response', async () => {
    const client = hc<typeof route>('http://localhost', {
      fetch: (req, init) => {
        return app.request(req, init)
      },
    })

    const res = await client.author.$post({
      form: {
        name: 'Space Cat',
        age: '20',
        nickname: 'meow',
      },
    })

    expect(res).not.toBeNull()
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json).toEqual({
      success: true,
      message: 'Space Cat is 20, nickname is meow',
    })
  })

  it('Should return 400 response', async () => {
    const formData = new FormData()

    const req = new Request('http://localhost/author', {
      body: formData,
      method: 'POST',
    })

    const res = await app.request(req)
    expect(res).not.toBeNull()
    expect(res.status).toBe(400)

    const json = await res.json()
    expect(json).toEqual({
      success: false,
      message: 'Bad Request',
    })
  })
})
