/* eslint-disable @typescript-eslint/no-explicit-any */
import {webcrypto} from 'node:crypto'
import type {  MiddlewareHandler, Next } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { describe, expect, it, vi } from 'vitest'
import { authHandler, verifyAuth } from '../src/index'

// @ts-expect-error - global crypto
global.crypto =  webcrypto

describe('next auth', () => {
  let c: any
  let req: any
  let next: Next

  beforeEach(() => {
    req = {
      raw: new Request('http://localhost:3000/api/auth/signin'),
    }
    ;(c = {
      env: {},
      req: req,
    }),
    (next = vi.fn())
  })

  it('should throw an error if NEXTAUTH_URL is missing', async () => {
    c.get = vi.fn().mockReturnValue({providers:[] })
    const handler: MiddlewareHandler = authHandler()
    await expect(handler(c, next)).rejects.toThrow('Missing AUTH_URL')
  })

  it('should throw an error if NEXTAUTH_SECRET is missing', async () => {
    c.get = vi.fn().mockReturnValue({ providers:[] ,authUrl:'http://localhost'})
    const handler: MiddlewareHandler = authHandler()
    await expect(handler(c, next)).rejects.toThrow('Missing AUTH_SECRET')
  })

  it('should return an instance of Response if NEXTAUTH_URL and NEXTAUTH_SECRET are present', async () => {
    c.get = vi.fn().mockReturnValue({authUrl:'http://localhost:3000', secret: 'secret',providers:[] })
    const handler: MiddlewareHandler = authHandler()
    const result = await handler(c, next)
    expect(result).toBeInstanceOf(Response)
  })

  it('should throw an error if auth cookie is missing', async () => {
    c.get = vi.fn().mockReturnValue({authUrl:'http://localhost:3000', secret: 'secret',providers:[] })
    const handler: MiddlewareHandler = verifyAuth()
    expect(handler(c, next)).rejects.toBeInstanceOf(HTTPException)
  })
})
