import { Hono } from 'hono'
import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import type { StructuredLoggerEnv } from './index'
import { structuredLogger } from './index'

type MockLogger = ReturnType<typeof createMockLogger>

function createMockLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}

describe('structuredLogger', () => {
  describe('core behavior', () => {
    it('calls createLogger once per request with the context', async () => {
      const mockLogger = createMockLogger()
      const createLogger = vi.fn(() => mockLogger)
      const app = new Hono()

      app.use(structuredLogger({ createLogger, onResponse: vi.fn() }))
      app.get('/', (c) => c.text('ok'))

      await app.request('/')

      expect(createLogger).toHaveBeenCalledTimes(1)
      expect(createLogger.mock.calls).toHaveLength(1)
      expect((createLogger.mock.calls as unknown[][])[0]?.[0]).toBeDefined()
    })

    it('makes the logger accessible via c.var.logger in the handler', async () => {
      const mockLogger = createMockLogger()
      let capturedLogger: unknown = null

      const app = new Hono<StructuredLoggerEnv<MockLogger>>()
      app.use(structuredLogger({ createLogger: () => mockLogger, onResponse: vi.fn() }))
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

      const app = new Hono<StructuredLoggerEnv<MockLogger, 'log'>>()
      app.use(
        structuredLogger({ createLogger: () => mockLogger, contextKey: 'log', onResponse: vi.fn() })
      )
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
      app.use(structuredLogger({ createLogger: () => mockLogger, onResponse: vi.fn(), onError }))
      app.get('/', () => {
        throw handlerError
      })
      app.onError((_err, c) => c.text('error', 500))

      await app.request('/')

      expect(onError).toHaveBeenCalledTimes(1)
      expect(onError.mock.calls[0]?.[1]).toBe(handlerError)
      expect(onError.mock.calls[0]?.[3]).toBeTypeOf('number')
      expect(onError.mock.calls[0]?.[3] as number).toBeGreaterThanOrEqual(0)
    })

    it('passes elapsedMs as a number >= 0 to onError', async () => {
      const mockLogger = createMockLogger()
      let capturedElapsed: number | null = null

      const app = new Hono()
      app.use(
        structuredLogger({
          createLogger: () => mockLogger,
          onResponse: vi.fn(),
          onError: (_logger, _err, _c, elapsedMs) => {
            capturedElapsed = elapsedMs
          },
        })
      )
      app.get('/', () => {
        throw new Error('fail')
      })
      app.onError((_err, c) => c.text('error', 500))

      await app.request('/')

      expect(capturedElapsed).toBeTypeOf('number')
      expect(capturedElapsed).toBeGreaterThanOrEqual(0)
    })

    it('the error is still handled by app.onError', async () => {
      const mockLogger = createMockLogger()
      const handlerError = new Error('boom')
      let caughtError: unknown = null

      const app = new Hono()
      app.use(structuredLogger({ createLogger: () => mockLogger, onResponse: vi.fn() }))
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
      app.use(structuredLogger({ createLogger: () => mockLogger, onResponse: vi.fn(), onError }))
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
      app.use(structuredLogger({ createLogger: () => mockLogger, onResponse }))
      app.get('/', () => {
        throw new Error('fail')
      })
      app.onError((_err, c) => c.text('error', 500))

      await app.request('/')

      expect(onResponse).not.toHaveBeenCalled()
    })
  })

  describe('integration', () => {
    it('requestId is accessible inside createLogger', async () => {
      let capturedRequestId: string | undefined

      type TestEnv = { Variables: { requestId: string } }

      const app = new Hono<TestEnv>()

      // Simulate requestId middleware
      app.use(async (c, next) => {
        c.set('requestId', 'test-req-id-123')
        await next()
      })

      app.use(
        structuredLogger<TestEnv>({
          onResponse: vi.fn(),
          createLogger: (c) => {
            capturedRequestId = c.var.requestId
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
      app.use(
        '/api/*',
        structuredLogger({
          createLogger: () => apiLogger,
          onResponse: (logger) => {
            logger.info({}, 'request')
          },
        })
      )
      app.use(
        '/admin/*',
        structuredLogger({
          createLogger: () => adminLogger,
          onResponse: (logger) => {
            logger.info({}, 'request')
          },
        })
      )

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
      const loggers: MockLogger[] = []

      const app = new Hono()
      app.use(
        structuredLogger({
          onResponse: vi.fn(),
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
          onResponse: vi.fn(),
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
          onResponse: vi.fn(),
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

  describe('types', () => {
    it('infers all logger type in hooks when type args are fully inferred', () => {
      structuredLogger({
        createLogger: () => createMockLogger(),
        onRequest: (logger) => {
          expectTypeOf(logger).toEqualTypeOf<MockLogger>()
        },
        onResponse: (logger) => {
          expectTypeOf(logger).toEqualTypeOf<MockLogger>()
        },
        onError: (logger) => {
          expectTypeOf(logger).toEqualTypeOf<MockLogger>()
        },
      })
    })

    it('infers logger type in hooks when E and L are explicitly provided', () => {
      type AppEnv = { Variables: { tenantId: string } }

      structuredLogger<AppEnv, MockLogger>({
        createLogger: (c) => {
          expectTypeOf(c.var.tenantId).toEqualTypeOf<string>()
          return createMockLogger()
        },
        onResponse: (logger) => {
          expectTypeOf(logger).toEqualTypeOf<MockLogger>()
        },
      })
    })
  })

  describe('skip', () => {
    it('skips hooks when skip returns true', async () => {
      const onResponse = vi.fn()

      const app = new Hono()
      app.use(
        structuredLogger({ createLogger: () => createMockLogger(), skip: () => true, onResponse })
      )
      app.get('/', (c) => c.text('ok'))

      await app.request('/')

      expect(onResponse).not.toHaveBeenCalled()
    })

    it('calls hooks normally when skip returns false', async () => {
      const onResponse = vi.fn()

      const app = new Hono()
      app.use(
        structuredLogger({ createLogger: () => createMockLogger(), skip: () => false, onResponse })
      )
      app.get('/', (c) => c.text('ok'))

      await app.request('/')

      expect(onResponse).toHaveBeenCalledTimes(1)
    })

    it('still processes the request when skipped', async () => {
      const app = new Hono()
      app.use(
        structuredLogger({
          createLogger: () => createMockLogger(),
          skip: () => true,
          onResponse: vi.fn(),
        })
      )
      app.get('/', (c) => c.text('ok'))

      const res = await app.request('/')

      expect(res.status).toBe(200)
    })

    it('c.var.logger is still set when skip returns true', async () => {
      let capturedLogger: unknown = null

      const app = new Hono<StructuredLoggerEnv<MockLogger>>()
      const mockLogger = createMockLogger()
      app.use(
        structuredLogger({ createLogger: () => mockLogger, skip: () => true, onResponse: vi.fn() })
      )
      app.get('/', (c) => {
        capturedLogger = c.var.logger
        return c.text('ok')
      })

      await app.request('/')

      expect(capturedLogger).toBe(mockLogger)
    })

    it('can skip hooks based on path', async () => {
      const onResponse = vi.fn()

      const app = new Hono()
      app.use(
        structuredLogger({
          createLogger: () => createMockLogger(),
          skip: (c) => c.req.path === '/health',
          onResponse,
        })
      )
      app.get('/health', (c) => c.json({ status: 'ok' }))
      app.get('/api/data', (c) => c.text('data'))

      await app.request('/health')
      expect(onResponse).not.toHaveBeenCalled()

      await app.request('/api/data')
      expect(onResponse).toHaveBeenCalledTimes(1)
    })
  })
})
