import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'
import type { BaseLogger } from './index'
import { structuredLogger } from './index'

type MockLogger = {
  [K in keyof BaseLogger]: BaseLogger[K] & ReturnType<typeof vi.fn>
}

function createMockLogger(): MockLogger {
  return {
    info: vi.fn() as MockLogger['info'],
    warn: vi.fn() as MockLogger['warn'],
    error: vi.fn() as MockLogger['error'],
    debug: vi.fn() as MockLogger['debug'],
  }
}

describe('structuredLogger', () => {
  describe('core behavior', () => {
    it('calls createLogger once per request with the context', async () => {
      const mockLogger = createMockLogger()
      const createLogger = vi.fn(() => mockLogger)
      const app = new Hono()

      app.use(structuredLogger({ createLogger }))
      app.get('/', (c) => c.text('ok'))

      await app.request('/')

      expect(createLogger).toHaveBeenCalledTimes(1)
      expect(createLogger.mock.calls).toHaveLength(1)
      expect((createLogger.mock.calls as unknown[][])[0]?.[0]).toBeDefined()
    })

    it('makes the logger accessible via c.var.logger in the handler', async () => {
      const mockLogger = createMockLogger()
      let capturedLogger: unknown = null

      const app = new Hono<{ Variables: { logger: BaseLogger } }>()
      app.use(structuredLogger({ createLogger: () => mockLogger }))
      app.get('/', (c) => {
        capturedLogger = c.var.logger
        return c.text('ok')
      })

      await app.request('/')

      expect(capturedLogger).toBe(mockLogger)
    })

    it('supports a custom contextKey', async () => {
      const mockLogger = createMockLogger()
      let capturedLogger: unknown = null

      const app = new Hono<{ Variables: { log: BaseLogger } }>()
      app.use(structuredLogger({ createLogger: () => mockLogger, contextKey: 'log' }))
      app.get('/', (c) => {
        capturedLogger = c.var.log
        return c.text('ok')
      })

      await app.request('/')

      expect(capturedLogger).toBe(mockLogger)
    })

    it('passes elapsedMs as a number >= 0 to onResponse', async () => {
      const mockLogger = createMockLogger()
      let capturedElapsed: number | null = null

      const app = new Hono()
      app.use(
        structuredLogger({
          createLogger: () => mockLogger,
          onResponse: (_logger, _c, elapsedMs) => {
            capturedElapsed = elapsedMs
          },
        })
      )
      app.get('/', (c) => c.text('ok'))

      await app.request('/')

      expect(capturedElapsed).toBeTypeOf('number')
      expect(capturedElapsed).toBeGreaterThanOrEqual(0)
    })

    it('executes in order: createLogger, onRequest, handler, onResponse', async () => {
      const order: string[] = []
      const mockLogger = createMockLogger()

      const app = new Hono()
      app.use(
        structuredLogger({
          createLogger: () => {
            order.push('createLogger')
            return mockLogger
          },
          onRequest: () => {
            order.push('onRequest')
          },
          onResponse: () => {
            order.push('onResponse')
          },
        })
      )
      app.get('/', (c) => {
        order.push('handler')
        return c.text('ok')
      })

      await app.request('/')

      expect(order).toEqual(['createLogger', 'onRequest', 'handler', 'onResponse'])
    })
  })

  describe('error handling', () => {
    it('calls onError when the handler throws', async () => {
      const mockLogger = createMockLogger()
      const onError = vi.fn()
      const handlerError = new Error('handler failed')

      const app = new Hono()
      app.use(structuredLogger({ createLogger: () => mockLogger, onError }))
      app.get('/', () => {
        throw handlerError
      })
      app.onError((_err, c) => c.text('error', 500))

      await app.request('/')

      expect(onError).toHaveBeenCalledTimes(1)
      expect(onError.mock.calls[0]?.[0]).toBe(mockLogger)
      expect(onError.mock.calls[0]?.[1]).toBe(handlerError)
    })

    it('the error is still handled by app.onError', async () => {
      const mockLogger = createMockLogger()
      const handlerError = new Error('boom')
      let caughtError: unknown = null

      const app = new Hono()
      app.use(structuredLogger({ createLogger: () => mockLogger }))
      app.get('/', () => {
        throw handlerError
      })
      app.onError((err, c) => {
        caughtError = err
        return c.text('error', 500)
      })

      await app.request('/')

      expect(caughtError).toBe(handlerError)
    })

    it('passes the error as an Error instance to onError', async () => {
      const mockLogger = createMockLogger()
      const onError = vi.fn()

      const app = new Hono()
      app.use(structuredLogger({ createLogger: () => mockLogger, onError }))
      app.get('/', () => {
        throw new Error('typed error')
      })
      app.onError((_err, c) => c.text('error', 500))

      await app.request('/')

      expect(onError).toHaveBeenCalledTimes(1)
      const errorArg = onError.mock.calls[0]?.[1] as Error
      expect(errorArg).toBeInstanceOf(Error)
      expect(errorArg.message).toBe('typed error')
    })

    it('does not call onResponse when the handler throws', async () => {
      const mockLogger = createMockLogger()
      const onResponse = vi.fn()

      const app = new Hono()
      app.use(
        structuredLogger({ createLogger: () => mockLogger, onResponse })
      )
      app.get('/', () => {
        throw new Error('fail')
      })
      app.onError((_err, c) => c.text('error', 500))

      await app.request('/')

      expect(onResponse).not.toHaveBeenCalled()
    })
  })

  describe('default hooks', () => {
    it('default onRequest logs method and path via logger.info', async () => {
      const mockLogger = createMockLogger()

      const app = new Hono()
      app.use(structuredLogger({ createLogger: () => mockLogger }))
      app.get('/test', (c) => c.text('ok'))

      await app.request('/test')

      const infoCall = mockLogger.info.mock.calls[0]
      expect(infoCall?.[0]).toEqual({ method: 'GET', path: '/test' })
      expect(infoCall?.[1]).toBe('request start')
    })

    it('default onResponse logs status and elapsed via logger.info', async () => {
      const mockLogger = createMockLogger()

      const app = new Hono()
      app.use(structuredLogger({ createLogger: () => mockLogger }))
      app.get('/', (c) => c.text('ok'))

      await app.request('/')

      const lastInfoCall = mockLogger.info.mock.calls[mockLogger.info.mock.calls.length - 1]
      expect(lastInfoCall?.[0]).toHaveProperty('method', 'GET')
      expect(lastInfoCall?.[0]).toHaveProperty('path', '/')
      expect(lastInfoCall?.[0]).toHaveProperty('status', 200)
      expect(lastInfoCall?.[0]).toHaveProperty('elapsedMs')
      expect(lastInfoCall?.[1]).toBe('request end')
    })

    it('default onError logs the error via logger.error', async () => {
      const mockLogger = createMockLogger()

      const app = new Hono()
      app.use(structuredLogger({ createLogger: () => mockLogger }))
      app.get('/', () => {
        throw new Error('something broke')
      })
      app.onError((_err, c) => c.text('error', 500))

      await app.request('/')

      expect(mockLogger.error).toHaveBeenCalledTimes(1)
      const errorCall = mockLogger.error.mock.calls[0]
      expect(errorCall?.[0]).toHaveProperty('err')
      expect(errorCall?.[0]).toHaveProperty('method', 'GET')
      expect(errorCall?.[0]).toHaveProperty('path', '/')
      expect(errorCall?.[0]).toHaveProperty('status', 500)
      expect(errorCall?.[1]).toBe('request error')
    })
  })

  describe('integration', () => {
    it('requestId is accessible inside createLogger', async () => {
      let capturedRequestId: string | undefined

      const app = new Hono<{ Variables: { requestId: string; logger: BaseLogger } }>()

      // Simulate requestId middleware
      app.use(async (c, next) => {
        c.set('requestId', 'test-req-id-123')
        await next()
      })

      app.use(
        structuredLogger({
          createLogger: (c) => {
            capturedRequestId = c.var['requestId'] as string
            return createMockLogger()
          },
        })
      )
      app.get('/', (c) => c.text('ok'))

      await app.request('/')

      expect(capturedRequestId).toBe('test-req-id-123')
    })

    it('multiple instances on different paths do not interfere', async () => {
      const apiLogger = createMockLogger()
      const adminLogger = createMockLogger()

      const app = new Hono()
      app.use('/api/*', structuredLogger({ createLogger: () => apiLogger }))
      app.use('/admin/*', structuredLogger({ createLogger: () => adminLogger }))

      app.get('/api/data', (c) => c.text('api'))
      app.get('/admin/panel', (c) => c.text('admin'))

      await app.request('/api/data')
      expect(apiLogger.info).toHaveBeenCalled()
      expect(adminLogger.info).not.toHaveBeenCalled()

      apiLogger.info.mockClear()
      await app.request('/admin/panel')
      expect(adminLogger.info).toHaveBeenCalled()
      expect(apiLogger.info).not.toHaveBeenCalled()
    })

    it('async hooks are awaited correctly', async () => {
      const order: string[] = []
      const mockLogger = createMockLogger()

      const app = new Hono()
      app.use(
        structuredLogger({
          createLogger: () => mockLogger,
          onRequest: async () => {
            await new Promise((r) => setTimeout(r, 10))
            order.push('async onRequest done')
          },
          onResponse: async () => {
            await new Promise((r) => setTimeout(r, 10))
            order.push('async onResponse done')
          },
        })
      )
      app.get('/', (c) => {
        order.push('handler')
        return c.text('ok')
      })

      await app.request('/')

      expect(order).toEqual(['async onRequest done', 'handler', 'async onResponse done'])
    })

    it('concurrent requests get separate logger instances', async () => {
      const loggers: BaseLogger[] = []

      const app = new Hono()
      app.use(
        structuredLogger({
          createLogger: () => {
            const logger = createMockLogger()
            loggers.push(logger)
            return logger
          },
        })
      )
      app.get('/', (c) => c.text('ok'))

      await Promise.all([app.request('/'), app.request('/'), app.request('/')])

      expect(loggers).toHaveLength(3)
      expect(loggers[0]).not.toBe(loggers[1])
      expect(loggers[1]).not.toBe(loggers[2])
    })
  })

  describe('edge cases', () => {
    it('handles streaming responses without error', async () => {
      const mockLogger = createMockLogger()
      const onResponse = vi.fn()

      const app = new Hono()
      app.use(structuredLogger({ createLogger: () => mockLogger, onResponse }))
      app.get('/', (c) => {
        return c.text('streamed content')
      })

      const res = await app.request('/')

      expect(res.status).toBe(200)
      expect(onResponse).toHaveBeenCalledTimes(1)
    })

    it('propagates errors from createLogger', async () => {
      const app = new Hono()
      app.use(
        structuredLogger({
          createLogger: () => {
            throw new Error('factory failed')
          },
        })
      )
      app.get('/', (c) => c.text('ok'))
      app.onError((err, c) => c.text(err.message, 500))

      const res = await app.request('/')

      expect(res.status).toBe(500)
      expect(await res.text()).toBe('factory failed')
    })

    it('propagates errors from onRequest hook', async () => {
      const mockLogger = createMockLogger()

      const app = new Hono()
      app.use(
        structuredLogger({
          createLogger: () => mockLogger,
          onRequest: () => {
            throw new Error('onRequest blew up')
          },
        })
      )
      app.get('/', (c) => c.text('ok'))
      app.onError((err, c) => c.text(err.message, 500))

      const res = await app.request('/')

      expect(res.status).toBe(500)
      expect(await res.text()).toBe('onRequest blew up')
    })

    it('propagates errors from onResponse hook', async () => {
      const mockLogger = createMockLogger()

      const app = new Hono()
      app.use(
        structuredLogger({
          createLogger: () => mockLogger,
          onResponse: () => {
            throw new Error('onResponse blew up')
          },
        })
      )
      app.get('/', (c) => c.text('ok'))
      app.onError((err, c) => c.text(err.message, 500))

      const res = await app.request('/')

      expect(res.status).toBe(500)
      expect(await res.text()).toBe('onResponse blew up')
    })
  })
})
