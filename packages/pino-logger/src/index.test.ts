/* eslint-disable @typescript-eslint/unbound-method */
import { Hono } from 'hono'
import type pino from 'pino'
import { describe, expect, it, vi } from 'vitest'
import { pinoLogger } from '.'

describe('pinoLogger', () => {
  it('should log request info and bind logger to context with default settings', async () => {
    const mockChild = {
      info: vi.fn(),
    }
    const mockLogger = {
      child: vi.fn(() => mockChild),
    } as unknown as pino.Logger

    const app = new Hono()
    app.use(pinoLogger({ logger: mockLogger }))
    app.get('/', (c) => {
      const logger = c.get('logger')
      expect(logger).toBe(mockChild)
      logger.info('inside handler')
      return c.text('ok')
    })

    const res = await app.request('/')
    expect(res.status).toBe(200)

    expect(mockLogger.child).toHaveBeenCalledWith({})
    expect(mockChild.info).toHaveBeenCalledWith('inside handler')
    expect(mockChild.info).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: 'incoming request',
        method: 'GET',
        path: '/',
      })
    )
    expect(mockChild.info).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: 'request completed',
        method: 'GET',
        path: '/',
        status: 200,
      })
    )
  })

  it('should use custom contextKey', async () => {
    const mockChild = {
      info: vi.fn(),
    }
    const mockLogger = {
      child: vi.fn(() => mockChild),
    } as unknown as pino.Logger

    const app = new Hono<{ Variables: { customLog: pino.Logger } }>()
    app.use(pinoLogger({ logger: mockLogger, contextKey: 'customLog' }))
    app.get('/', (c) => {
      const logger = c.var.customLog
      expect(logger).toBe(mockChild)
      return c.text('ok')
    })

    const res = await app.request('/')
    expect(res.status).toBe(200)
  })

  it('should append requestId to child logger', async () => {
    const mockChild = {
      info: vi.fn(),
    }
    const mockLogger = {
      child: vi.fn(() => mockChild),
    } as unknown as pino.Logger

    const app = new Hono<{ Variables: { requestId: string } }>()
    // Simulate setting requestId
    app.use('*', async (c, next) => {
      c.set('requestId', 'test-req-123')
      await next()
    })
    app.use(pinoLogger({ logger: mockLogger }))
    app.get('/', (c) => c.text('ok'))

    await app.request('/')
    expect(mockLogger.child).toHaveBeenCalledWith({ reqId: 'test-req-123' })
  })

  it('should fallback to x-request-id header if context requestId is missing', async () => {
    const mockChild = {
      info: vi.fn(),
    }
    const mockLogger = {
      child: vi.fn(() => mockChild),
    } as unknown as pino.Logger

    const app = new Hono()
    app.use(pinoLogger({ logger: mockLogger }))
    app.get('/', (c) => c.text('ok'))

    await app.request('/', {
      headers: {
        'x-request-id': 'header-req-456',
      },
    })
    expect(mockLogger.child).toHaveBeenCalledWith({ reqId: 'header-req-456' })
  })

  it('should allow custom onRequest and onResponse hooks', async () => {
    const mockChild = {}
    const mockLogger = {
      child: vi.fn(() => mockChild),
    } as unknown as pino.Logger

    const customOnRequest = vi.fn()
    const customOnResponse = vi.fn()

    const app = new Hono()
    app.use(
      pinoLogger({
        logger: mockLogger,
        onRequest: customOnRequest,
        onResponse: customOnResponse,
      })
    )
    app.get('/', (c) => c.text('ok'))

    await app.request('/')
    expect(customOnRequest).toHaveBeenCalledWith(mockChild, expect.any(Object))
    expect(customOnResponse).toHaveBeenCalledWith(mockChild, expect.any(Object), expect.any(Number))
  })
})
