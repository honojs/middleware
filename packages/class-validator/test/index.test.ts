import { Hono } from 'hono'
import { classValidator } from '../src'
import type { Equal, Expect } from 'hono/utils/types'
import { IsInt, IsString, ValidateNested, ValidationError } from 'class-validator'
import { ExtractSchema } from 'hono/types'
import { Type } from 'class-transformer'

describe('Basic', () => {
  const app = new Hono()

  class UserDto {
    @IsString()
    name!: string

    @IsInt()
    age!: number
  }

  const route = app.post('/author', classValidator('json', UserDto), (c) => {
    const data = c.req.valid('json')
    return c.json({
      success: true,
      message: `${data.name} is ${data.age}`,
    })
  })

  type Actual = ExtractSchema<typeof route>
  type Expected = {
    '/author': {
      $post: {
        input: {
          json: {
            name: string
            age: number
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

  it('Should return 400 response', async () => {
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
    const data = (await res.json()) as { errors: ValidationError[] }
    expect(data.errors.length).toBe(1)
  })
})

describe('With Hook', () => {
  const app = new Hono()

  class PostDto {
    @IsInt()
    id!: number

    @IsString()
    title!: string
  }

  app
    .post(
      '/post',
      classValidator('json', PostDto, (result, c) => {
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
      classValidator('json', PostDto, (result, c) => {
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

  it('Should return 400 response and error array', async () => {
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

    const { errors, success } = (await res.json()) as {
      success: boolean
      errors: ValidationError[]
    }
    expect(success).toBe(false)
    expect(Array.isArray(errors)).toBe(true)
  })
})

describe('Nested DTO', () => {
  const app = new Hono()

  class AuthorDto {
    @IsString()
    name!: string

    @ValidateNested({ each: true })
    @Type(() => PostDto)
    posts!: PostDto[]
  }

  class PostDto {
    @IsInt()
    id!: number

    @IsString()
    title!: string
  }

  app.post('/author', classValidator('json', AuthorDto), (c) => {
    const data = c.req.valid('json')

    return c.json({
      success: true,
      message: `Posts sent: ${data.posts.length}`,
    })
  })

  it('Should return 200 response', async () => {
    const req = new Request('http://localhost/author', {
      body: JSON.stringify({
        name: 'Superman',
        posts: [
          {
            id: 1,
            title: 'Volume 1',
          },
        ],
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
      message: 'Posts sent: 1',
    })
  })

  it('Should return 400 response', async () => {
    const req = new Request('http://localhost/author', {
      body: JSON.stringify({
        name: 'Superman',
        posts: [
          {
            id: '1223',
            name: 'Error id',
          },
        ],
      }),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    const res = await app.request(req)
    expect(res).not.toBeNull()
    expect(res.status).toBe(400)
    const data = (await res.json()) as { errors: ValidationError[] }
    expect(data.errors.length).toBe(1)
  })
})
