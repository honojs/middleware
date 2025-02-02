import { parseWithYup } from '@conform-to/yup'
import { Hono } from 'hono'
import { hc } from 'hono/client'
import type { ExtractSchema, ParsedFormValue } from 'hono/types'
import type { StatusCode } from 'hono/utils/http-status'
import type { Equal, Expect } from 'hono/utils/types'
import * as y from 'yup'
import { conformValidator } from '../src'

describe('Validate requests using a Yup schema', () => {
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
      const value = submission.value

      return c.json({
        success: true,
        message: `${value.name} is ${value.age}, nickname is ${
          value?.nickname || 'nothing yet :3'
        }`,
      })
    }
  )

  it('check the route object types', () => {
    type Actual = ExtractSchema<typeof route>
    type Expected = {
      '/author': {
        $post: {
          input: {
            form: {
              name: ParsedFormValue | ParsedFormValue[]
              age: ParsedFormValue | ParsedFormValue[]
              nickname?: ParsedFormValue | ParsedFormValue[] | undefined
            }
          }
          output: {
            success: boolean
            message: string
          }
          outputFormat: 'json'
          status: StatusCode
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
    expect(json).toMatchObject({
      status: 'error',
      error: {
        name: ['name is a required field'],
        age: ['age is a required field'],
      },
    })
  })
})
