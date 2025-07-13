import type { StandardSchemaV1 } from '@standard-schema/spec'
import { Hono } from 'hono'
import type { Equal, Expect, UnionToIntersection } from 'hono/utils/types'
import { vi } from 'vitest'

import * as arktypeSchemas from '../__schemas__/arktype'
import * as valibotSchemas from '../__schemas__/valibot'
import * as zodSchemas from '../__schemas__/zod'
import { sValidator } from '.'

type ExtractSchema<T> = T extends Hono<infer _, infer S> ? S : never
type MergeDiscriminatedUnion<U> =
  UnionToIntersection<U> extends infer O ? { [K in keyof O]: O[K] } : never

const libs = ['valibot', 'zod', 'arktype'] as const
const schemasByLibrary = {
  valibot: valibotSchemas,
  zod: zodSchemas,
  arktype: arktypeSchemas,
}

describe('Standard Schema Validation', () => {
  libs.forEach((lib) => {
    const schemas = schemasByLibrary[lib]
    describe(`Using ${lib} schemas for validation`, () => {
      describe('Basic', () => {
        const app = new Hono()
        const route = app.post(
          '/author',
          sValidator('json', schemas.personJSONSchema),
          sValidator('query', schemas.queryNameSchema),
          (c) => {
            const data = c.req.valid('json')
            const query = c.req.valid('query')

            return c.json({
              success: true,
              message: `${data.name} is ${data.age}`,
              queryName: query?.name,
            })
          }
        )

        type Actual = ExtractSchema<typeof route>
        type verifyOutput = Expect<
          Equal<
            {
              success: boolean
              message: string
              queryName: string | undefined
            },
            MergeDiscriminatedUnion<Actual['/author']['$post']['output']>
          >
        >
        type verifyJSONInput = Expect<
          Equal<
            {
              name: string
              age: number
            },
            MergeDiscriminatedUnion<Actual['/author']['$post']['input']['json']>
          >
        >
        type verifyQueryInput = Expect<
          Equal<
            | {
                name?: string | undefined
              }
            | {
                name?: string | undefined
              }
            | {
                name?: string | undefined
              }
            | undefined,
            Actual['/author']['$post']['input']['query']
          >
        >

        it('Should return 200 response', async () => {
          const req = new Request('http://localhost/author?name=Metallo', {
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
            queryName: 'Metallo',
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
              'content-type': 'application/json',
            },
          })
          const res = await app.request(req)
          expect(res).not.toBeNull()
          expect(res.status).toBe(400)
          const data = (await res.json()) as { success: boolean }
          expect(data['success']).toBe(false)
        })
      })

      describe('coerce', () => {
        const app = new Hono()
        const schema = schemas.queryPaginationSchema

        const route = app.get('/page', sValidator('query', schema), (c) => {
          const { page } = c.req.valid('query')
          return c.json({ page })
        })

        type Actual = ExtractSchema<typeof route>
        type Expected = {
          '/page': {
            $get: {
              input: {
                query:
                  | {
                      page: string | string[]
                    }
                  | {
                      page: string | string[]
                    }
                  | {
                      page: string | string[]
                    }
              }
              output: {
                page: number
              }
            }
          }
        }

        type verifyInput = Expect<
          Equal<
            { page: string | string[] },
            MergeDiscriminatedUnion<Actual['/page']['$get']['input']['query']>
          >
        >
        type verifyOutput = Expect<
          Equal<
            {
              page: number
            },
            MergeDiscriminatedUnion<Actual['/page']['$get']['output']>
          >
        >

        it('Should return 200 response', async () => {
          const res = await app.request('/page?page=123')
          expect(res).not.toBeNull()
          expect(res.status).toBe(200)
          expect(await res.json()).toEqual({
            page: 123,
          })
        })
      })

      describe('With Hook', () => {
        const app = new Hono()

        const schema = schemas.postJSONSchema

        app.post(
          '/post',
          sValidator('json', schema, (result, c) => {
            if (!result.success) {
              type verify = Expect<Equal<readonly StandardSchemaV1.Issue[], typeof result.error>>
              return c.text(`${result.data.id} is invalid!`, 400)
            }
          }),
          (c) => {
            const data = c.req.valid('json')
            return c.text(`${data.id} is valid!`)
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
          expect(await res.text()).toBe('123 is invalid!')
        })
      })

      describe('With Async Hook', () => {
        const app = new Hono()

        const schema = schemas.postJSONSchema

        app.post(
          '/post',
          sValidator('json', schema, async (result, c) => {
            if (!result.success) {
              return c.text(`${result.data.id} is invalid!`, 400)
            }
          }),
          (c) => {
            const data = c.req.valid('json')
            return c.text(`${data.id} is valid!`)
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
          expect(await res.text()).toBe('123 is invalid!')
        })
      })

      describe('With target', () => {
        it('should call hook for correctly validated target', async () => {
          const app = new Hono()

          const schema = schemas.idJSONSchema

          const jsonHook = vi.fn()
          const paramHook = vi.fn()
          const queryHook = vi.fn()
          app.post(
            '/:id/post',
            sValidator('json', schema, jsonHook),
            sValidator('param', schema, paramHook),
            sValidator('query', schema, queryHook),
            (c) => {
              return c.text('ok')
            }
          )

          const req = new Request('http://localhost/1/post?id=2', {
            body: JSON.stringify({
              id: '3',
            }),
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          })

          const res = await app.request(req)
          expect(res).not.toBeNull()
          expect(res.status).toBe(200)
          expect(await res.text()).toBe('ok')
          expect(paramHook).toHaveBeenCalledWith(
            { data: { id: '1' }, success: true, target: 'param' },
            expect.anything()
          )
          expect(queryHook).toHaveBeenCalledWith(
            { data: { id: '2' }, success: true, target: 'query' },
            expect.anything()
          )
          expect(jsonHook).toHaveBeenCalledWith(
            { data: { id: '3' }, success: true, target: 'json' },
            expect.anything()
          )
        })
      })

      describe('Only Types', () => {
        it('Should return correct enum types for query', () => {
          const app = new Hono()

          const schema = schemas.querySortSchema

          const route = app.get('/', sValidator('query', schema), (c) => {
            const data = c.req.valid('query')
            return c.json(data)
          })

          type Actual = ExtractSchema<typeof route>
          type verifyInput = Expect<
            Equal<
              { order: 'asc' | 'desc' },
              MergeDiscriminatedUnion<Actual['/']['$get']['input']['query']>
            >
          >
          type verifyOutput = Expect<
            Equal<{ order: 'asc' | 'desc' }, MergeDiscriminatedUnion<Actual['/']['$get']['output']>>
          >
        })
      })

      describe('Sensitive Data Removal', () => {
        it("doesn't return cookies after headers validation", async () => {
          const app = new Hono()

          const schema = schemas.headerSchema

          app.get('/headers', sValidator('header', schema), (c) =>
            c.json({ success: true, userAgent: c.req.header('User-Agent') })
          )

          const req = new Request('http://localhost/headers', {
            headers: {
              // Not passing the User-Agent header to trigger the validation error
              Cookie: 'SECRET=123',
            },
          })

          const res = await app.request(req)
          expect(res.status).toBe(400)
          const data = (await res.json()) as { success: false; error: unknown[] }
          expect(data.success).toBe(false)
          expect(data.error).toBeDefined()
          if (lib === 'arktype') {
            expect((data.error as { data: Record<string,unknown>}[]).some((error) => error.data && error.data.cookie)).toBe(false)
          }
        })
      })
    })
  })
})
