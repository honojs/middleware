import { describe, expect, it } from 'vitest'
import { OpenAPIHono, createRoute, z } from './index'

describe('Validation Security - Body Required Behavior', () => {
  const PostSchema = z.object({
    title: z.string().min(5),
    content: z.string(),
  })

  describe('JSON body validation', () => {
    describe('when body.required is not specified (default behavior)', () => {
      const route = createRoute({
        method: 'post',
        path: '/posts',
        request: {
          body: {
            content: {
              'application/json': {
                schema: PostSchema,
              },
            },
            // required is not specified - should default to strict validation
          },
        },
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                schema: z.object({ success: z.boolean() }),
              },
            },
          },
        },
      })

      const app = new OpenAPIHono()
      app.openapi(route, async (c) => {
        const body = c.req.valid('json')
        return c.json({ success: true }, 200)
      })

      it('should validate when content-type is application/json', async () => {
        const res = await app.request('/posts', {
          method: 'POST',
          body: JSON.stringify({ title: 'Valid Title', content: 'Content' }),
          headers: { 'Content-Type': 'application/json' },
        })
        expect(res.status).toBe(200)
      })

      it('should reject invalid body when content-type is application/json', async () => {
        const res = await app.request('/posts', {
          method: 'POST',
          body: JSON.stringify({ title: 'Bad' }), // title too short
          headers: { 'Content-Type': 'application/json' },
        })
        expect(res.status).toBe(400)
      })

      it('should reject request without content-type (security fix)', async () => {
        const res = await app.request('/posts', {
          method: 'POST',
          body: JSON.stringify({ title: 'Bad' }),
        })
        expect(res.status).toBe(400) // Should validate by default
      })

      it('should return 400 for wrong content-type', async () => {
        const res = await app.request('/posts', {
          method: 'POST',
          body: JSON.stringify({ title: 'Valid Title', content: 'Content' }),
          headers: { 'Content-Type': 'text/plain' },
        })
        expect(res.status).toBe(400)
        const json = await res.json()
        expect(json).toHaveProperty('error')
        expect(json.error.message).toContain('Invalid content-type')
      })
    })

    describe('when body.required is explicitly true', () => {
      const route = createRoute({
        method: 'post',
        path: '/posts',
        request: {
          body: {
            content: {
              'application/json': {
                schema: PostSchema,
              },
            },
            required: true,
          },
        },
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                schema: z.object({ success: z.boolean() }),
              },
            },
          },
        },
      })

      const app = new OpenAPIHono()
      app.openapi(route, async (c) => {
        const body = c.req.valid('json')
        return c.json({ success: true }, 200)
      })

      it('should always validate the request body', async () => {
        const res = await app.request('/posts', {
          method: 'POST',
          body: JSON.stringify({ title: 'Bad' }),
          headers: { 'Content-Type': 'application/json' },
        })
        expect(res.status).toBe(400)
      })

      it('should reject request without content-type', async () => {
        const res = await app.request('/posts', {
          method: 'POST',
        })
        expect(res.status).toBe(400)
      })
    })

    describe('when body.required is explicitly false', () => {
      const route = createRoute({
        method: 'post',
        path: '/posts',
        request: {
          body: {
            content: {
              'application/json': {
                schema: PostSchema,
              },
            },
            required: false,
          },
        },
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                schema: z.object({ success: z.boolean() }),
              },
            },
          },
        },
      })

      const app = new OpenAPIHono()
      app.openapi(route, async (c) => {
        const body = c.req.valid('json')
        return c.json({ success: true, body }, 200)
      })

      it('should validate when content-type is application/json', async () => {
        const res = await app.request('/posts', {
          method: 'POST',
          body: JSON.stringify({ title: 'Bad' }), // Invalid
          headers: { 'Content-Type': 'application/json' },
        })
        expect(res.status).toBe(400)
      })

      it('should allow empty body when no content-type is provided', async () => {
        const res = await app.request('/posts', {
          method: 'POST',
        })
        expect(res.status).toBe(200)
        const json = await res.json()
        expect(json.body).toEqual({})
      })

      it('should return 400 for wrong content-type', async () => {
        const res = await app.request('/posts', {
          method: 'POST',
          body: 'plain text',
          headers: { 'Content-Type': 'text/plain' },
        })
        expect(res.status).toBe(400)
        const json = await res.json()
        expect(json.error.message).toContain('Invalid content-type')
      })
    })
  })

  describe('Form body validation', () => {
    const FormSchema = z.object({
      username: z.string().min(3),
      password: z.string().min(8),
    })

    describe('when body.required is not specified (default behavior)', () => {
      const route = createRoute({
        method: 'post',
        path: '/login',
        request: {
          body: {
            content: {
              'application/x-www-form-urlencoded': {
                schema: FormSchema,
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                schema: z.object({ success: z.boolean() }),
              },
            },
          },
        },
      })

      const app = new OpenAPIHono()
      app.openapi(route, async (c) => {
        const body = c.req.valid('form')
        return c.json({ success: true }, 200)
      })

      it('should validate when content-type is form-urlencoded', async () => {
        const params = new URLSearchParams()
        params.append('username', 'john')
        params.append('password', 'password123')

        const res = await app.request('/login', {
          method: 'POST',
          body: params,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })
        expect(res.status).toBe(200)
      })

      it('should reject invalid form data', async () => {
        const params = new URLSearchParams()
        params.append('username', 'jo') // Too short
        params.append('password', 'pass') // Too short

        const res = await app.request('/login', {
          method: 'POST',
          body: params,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })
        expect(res.status).toBe(400)
      })

      it('should reject request without content-type (security fix)', async () => {
        const params = new URLSearchParams()
        params.append('username', 'jo')

        const res = await app.request('/login', {
          method: 'POST',
          body: params,
        })
        expect(res.status).toBe(400)
      })

      it('should return 400 for wrong content-type', async () => {
        const res = await app.request('/login', {
          method: 'POST',
          body: JSON.stringify({ username: 'john', password: 'password123' }),
          headers: { 'Content-Type': 'application/json' },
        })
        expect(res.status).toBe(400)
        const json = await res.json()
        expect(json.error.message).toContain('Invalid content-type')
      })
    })

    describe('when body.required is explicitly false', () => {
      const route = createRoute({
        method: 'post',
        path: '/login',
        request: {
          body: {
            content: {
              'multipart/form-data': {
                schema: FormSchema,
              },
            },
            required: false,
          },
        },
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                schema: z.object({ success: z.boolean() }),
              },
            },
          },
        },
      })

      const app = new OpenAPIHono()
      app.openapi(route, async (c) => {
        const body = c.req.valid('form')
        return c.json({ success: true, body }, 200)
      })

      it('should allow empty body when no content-type is provided', async () => {
        const res = await app.request('/login', {
          method: 'POST',
        })
        expect(res.status).toBe(200)
        const json = await res.json()
        expect(json.body).toEqual({})
      })

      it('should return 400 for wrong content-type', async () => {
        const res = await app.request('/login', {
          method: 'POST',
          body: JSON.stringify({ username: 'john' }),
          headers: { 'Content-Type': 'application/json' },
        })
        expect(res.status).toBe(400)
        const json = await res.json()
        expect(json.error.message).toContain('Invalid content-type')
        expect(json.error.message).toContain('multipart/form-data')
      })
    })
  })

  describe('Multiple content-type support scenarios', () => {
    const PostSchema = z.object({
      title: z.string().min(5),
      content: z.string(),
    })

    const FormSchema = z.object({
      username: z.string().min(3),
      password: z.string().min(8),
    })

    describe('when both JSON and Form content-types are supported', () => {
      const route = createRoute({
        method: 'post',
        path: '/posts',
        request: {
          body: {
            content: {
              'application/json': {
                schema: PostSchema,
              },
              'application/x-www-form-urlencoded': {
                schema: FormSchema,
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                schema: z.object({ success: z.boolean() }),
              },
            },
          },
        },
      })

      const app = new OpenAPIHono()
      app.openapi(route, async (c) => {
        const jsonBody = c.req.valid('json')
        const formBody = c.req.valid('form')
        return c.json({ success: true, jsonBody, formBody }, 200)
      })

      it('should validate JSON when content-type is application/json', async () => {
        const res = await app.request('/posts', {
          method: 'POST',
          body: JSON.stringify({ title: 'Valid Title', content: 'Content' }),
          headers: { 'Content-Type': 'application/json' },
        })
        expect(res.status).toBe(200)
      })

      it('should validate Form when content-type is application/x-www-form-urlencoded', async () => {
        const params = new URLSearchParams()
        params.append('username', 'validuser')
        params.append('password', 'password123')

        const res = await app.request('/posts', {
          method: 'POST',
          body: params,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })
        expect(res.status).toBe(200)
      })

      it('should reject invalid JSON data', async () => {
        const res = await app.request('/posts', {
          method: 'POST',
          body: JSON.stringify({ title: 'Bad' }), // title too short
          headers: { 'Content-Type': 'application/json' },
        })
        expect(res.status).toBe(400)
      })

      it('should reject invalid Form data', async () => {
        const params = new URLSearchParams()
        params.append('username', 'ab') // username too short
        params.append('password', 'short') // password too short

        const res = await app.request('/posts', {
          method: 'POST',
          body: params,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })
        expect(res.status).toBe(400)
      })

      it('should return 400 for unsupported content-type even with multiple content-types', async () => {
        const res = await app.request('/posts', {
          method: 'POST',
          body: JSON.stringify({ title: 'Valid Title', content: 'Content' }),
          headers: { 'Content-Type': 'text/plain' },
        })
        expect(res.status).toBe(400)
        const json = await res.json()
        expect(json).toHaveProperty('error')
        expect(json.error.message).toContain('content-type')
      })

      it('should reject when no content-type is provided even with valid data (security test)', async () => {
        const res = await app.request('/posts', {
          method: 'POST',
          body: JSON.stringify({ title: 'Valid Title', content: 'Valid Content' }), // Valid data
        })
        expect(res.status).toBe(400)
      })
    })

    describe('when multiple content-types are supported with required: false', () => {
      const route = createRoute({
        method: 'post',
        path: '/posts',
        request: {
          body: {
            content: {
              'application/json': {
                schema: PostSchema,
              },
              'multipart/form-data': {
                schema: FormSchema,
              },
            },
            required: false,
          },
        },
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                schema: z.object({ success: z.boolean() }),
              },
            },
          },
        },
      })

      const app = new OpenAPIHono()
      app.openapi(route, async (c) => {
        const jsonBody = c.req.valid('json')
        const formBody = c.req.valid('form')
        return c.json({ success: true, jsonBody, formBody }, 200)
      })

      it('should allow empty body when no content-type is provided', async () => {
        const res = await app.request('/posts', {
          method: 'POST',
        })
        expect(res.status).toBe(200)
      })

      it('should validate when matching content-type is provided', async () => {
        const res = await app.request('/posts', {
          method: 'POST',
          body: JSON.stringify({ title: 'Bad' }), // Invalid
          headers: { 'Content-Type': 'application/json' },
        })
        expect(res.status).toBe(400) // Should validate
      })

      it('should return 400 for unrecognized content-type even with required: false and multiple content-types', async () => {
        const res = await app.request('/posts', {
          method: 'POST',
          body: 'plain text',
          headers: { 'Content-Type': 'text/plain' },
        })
        expect(res.status).toBe(400)
        const json = await res.json()
        expect(json).toHaveProperty('error')
        expect(json.error.message).toContain('content-type')
      })
    })
  })
})
