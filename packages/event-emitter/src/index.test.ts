import {  Hono } from 'hono'
import type {Context} from 'hono'
import { describe, expect, it, vi } from 'vitest'
import {  createEmitter, defineHandler, defineHandlers, emitter } from './index'
import type {Emitter} from './index' // Adjust the import path as needed

describe('Event Emitter Middleware', () => {
  describe('createEmitter', () => {
    it('should create an emitter with initial handlers', () => {
      type EventPayloadMap = {
        test: { id: string; text: string }
      }
      const handlers = {
        test: [vi.fn()],
      }
      const ee = createEmitter<EventPayloadMap>(handlers)
      expect(ee).toBeDefined()
      expect(ee.emit).toBeDefined()
      expect(ee.on).toBeDefined()
      expect(ee.off).toBeDefined()
      expect(ee.emitAsync).toBeDefined()
    })

    it('should create an emitter without initial handlers', () => {
      const ee = createEmitter()
      expect(ee).toBeDefined()
    })

    it('should allow adding and removing handlers', () => {
      type EventPayloadMap = {
        test: string
      }
      const ee = createEmitter<EventPayloadMap>()
      const handler = vi.fn()
      ee.on('test', handler)
      ee.emit({} as Context, 'test', 'payload')
      expect(handler).toHaveBeenCalledWith({}, 'payload')

      ee.off('test', handler)
      ee.emit({} as Context, 'test', 'payload')
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('should remove all handlers for an event when no handler is specified', () => {
      type EventPayloadMap = {
        test: string
      }
      const ee = createEmitter<EventPayloadMap>()
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      ee.on('test', handler1)
      ee.on('test', handler2)
      ee.off('test')
      ee.emit({} as Context, 'test', 'payload')
      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).not.toHaveBeenCalled()
    })

    it('should emit events to all registered handlers', () => {
      type EventPayloadMap = {
        test: string
      }
      const ee = createEmitter<EventPayloadMap>()
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      ee.on('test', handler1)
      ee.on('test', handler2)
      ee.emit({} as Context, 'test', 'payload')
      expect(handler1).toHaveBeenCalledWith({}, 'payload')
      expect(handler2).toHaveBeenCalledWith({}, 'payload')
    })

    it('should not add the same named function handler multiple times', () => {
      type EventPayloadMap = {
        test: string
      }
      const ee = createEmitter<EventPayloadMap>()
      const handler = vi.fn()
      ee.on('test', handler)
      ee.on('test', handler)
      ee.emit({} as Context, 'test', 'payload')
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('should emit async events concurrently', async () => {
      type EventPayloadMap = {
        test: { id: string }
      }
      const ee = createEmitter<EventPayloadMap>()
      const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
      const handler1 = vi.fn(
        defineHandler<EventPayloadMap, 'test'>(async (_c, _payload) => {
          await delay(100)
        })
      )
      const handler2 = vi.fn(
        defineHandler<EventPayloadMap, 'test'>(async (_c, _payload) => {
          await delay(100)
        })
      )

      ee.on('test', handler1)
      ee.on('test', handler2)

      const start = Date.now()
      await ee.emitAsync({} as Context, 'test', { id: '123' }, { mode: 'concurrent' })
      const end = Date.now()

      // The total time should be close to 100ms (since handlers run concurrently)
      // We'll allow a small margin for execution time
      expect(end - start).toBeLessThan(150)

      expect(handler1).toHaveBeenCalledWith(expect.anything(), { id: '123' })
      expect(handler2).toHaveBeenCalledWith(expect.anything(), { id: '123' })
      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler2).toHaveBeenCalledTimes(1)
    })

    it('should emit async events sequentially', async () => {
      type EventPayloadMap = {
        test: { id: string }
      }
      const ee = createEmitter<EventPayloadMap>()
      const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
      const handler1 = vi.fn(
        defineHandler<EventPayloadMap, 'test'>(async (_c, _payload) => {
          await delay(100)
        })
      )
      const handler2 = vi.fn(
        defineHandler<EventPayloadMap, 'test'>(async (_c, _payload) => {
          await delay(100)
        })
      )
      ee.on('test', handler1)
      ee.on('test', handler2)
      const start = Date.now()
      await ee.emitAsync({} as Context, 'test', { id: '123' }, { mode: 'sequencial' })
      const end = Date.now()

      // The total time should be close to 200ms (since handlers run sequentially)
      // We'll allow a small margin for execution time
      expect(end - start).toBeGreaterThanOrEqual(200)
      expect(end - start).toBeLessThan(250)

      expect(handler1).toHaveBeenCalledWith(expect.anything(), { id: '123' })
      expect(handler2).toHaveBeenCalledWith(expect.anything(), { id: '123' })
      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler2).toHaveBeenCalledTimes(1)
    })

    it('should throw AggregateError when async handlers fail using emitAsync with concurent mode', async () => {
      type EventPayloadMap = {
        test: string
      }
      const ee = createEmitter<EventPayloadMap>()
      const handler1 = vi.fn().mockRejectedValue(new Error('Error 1'))
      const handler2 = vi.fn().mockRejectedValue(new Error('Error 2'))
      ee.on('test', handler1)
      ee.on('test', handler2)
      await expect(ee.emitAsync({} as Context, 'test', 'payload')).rejects.toThrow(AggregateError)
      try {
        await ee.emitAsync({} as Context, 'test', 'payload', { mode: 'concurrent' })
        // Should not reach here
        expect(true).toBe(false)
      } catch (error) {
        expect((error as AggregateError).errors).toHaveLength(2)
        expect((error as AggregateError).errors[0].message).toBe('Error 1')
        expect((error as AggregateError).errors[1].message).toBe('Error 2')
      }
    })

    it('should stop execution on first error in async handlers fail using emitAsync with sequential mode', async () => {
      type EventPayloadMap = {
        test: { id: string }
      }

      const ee = createEmitter<EventPayloadMap>()

      const handler1 = vi.fn(
        defineHandler<EventPayloadMap, 'test'>(async () => {
          throw new Error('Error 1')
        })
      )

      const handler2 = vi.fn(
        defineHandler<EventPayloadMap, 'test'>(async () => {
          // This should not be called
        })
      )

      ee.on('test', handler1)
      ee.on('test', handler2)

      try {
        await ee.emitAsync({} as Context, 'test', { id: '789' }, { mode: 'sequencial' })
        // Should not reach here
        expect(true).toBe(false)
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toBe('Error 1')
      }

      expect(handler1).toHaveBeenCalledWith(expect.anything(), { id: '789' })
      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler2).not.toHaveBeenCalled()
    })

    it('should throw TypeError when adding a non-function handler', () => {
      type EventPayloadMap = {
        test: string
      }
      const ee = createEmitter<EventPayloadMap>()
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      expect(() => ee.on('test', 'not a function' as any)).toThrow(TypeError)
    })

    it('should throw RangeError when max handlers limit is reached', () => {
      type EventPayloadMap = { test: string }
      const emitter = createEmitter<EventPayloadMap>({}, { maxHandlers: 3 })
      emitter.on('test', vi.fn())
      emitter.on('test', vi.fn())
      emitter.on('test', vi.fn())
      expect(() => emitter.on('test', vi.fn())).toThrow(RangeError)
    })

    it('should use default max handlers limit of 10 when not specified', () => {
      type EventPayloadMap = { testEvent: string }
      const emitter = createEmitter<EventPayloadMap>()
      for (let i = 0; i < 10; i++) {
        emitter.on('testEvent', vi.fn())
      }
      expect(() => emitter.on('testEvent', vi.fn())).toThrow(RangeError)
    })

    it('should allow different events to have their own handler counts', () => {
      type EventPayloadMap = { test1: string; test2: string }
      const emitter = createEmitter<EventPayloadMap>({}, { maxHandlers: 2 })
      emitter.on('test1', vi.fn())
      emitter.on('test1', vi.fn())
      emitter.on('test2', vi.fn())
      expect(() => emitter.on('test1', vi.fn())).toThrow(RangeError)
      expect(() => emitter.on('test2', vi.fn())).not.toThrow()
    })

    it('should include event key in error message when limit is reached', () => {
      type EventPayloadMap = { specificEvent: string }
      const emitter = createEmitter<EventPayloadMap>({}, { maxHandlers: 1 })
      emitter.on('specificEvent', vi.fn())
      expect(() => emitter.on('specificEvent', vi.fn())).toThrow(/specificEvent/)
    })

    it('should allow setting custom max handlers limit', () => {
      type EventPayloadMap = { test: string }
      const emitter = createEmitter<EventPayloadMap>({}, { maxHandlers: 5 })
      for (let i = 0; i < 5; i++) {
        emitter.on('test', vi.fn())
      }
      expect(() => emitter.on('test', vi.fn())).toThrow(RangeError)
    })

    it('should do nothing when emitting an event with no handlers', () => {
      type EventPayloadMap = {
        test: string
      }
      const ee = createEmitter<EventPayloadMap>()
      expect(() => ee.emit({} as Context, 'test', 'payload')).not.toThrow()
    })

    it('should do nothing when emitting an async event with no handlers', async () => {
      type EventPayloadMap = {
        test: string
      }
      const ee = createEmitter<EventPayloadMap>()
      await expect(ee.emitAsync({} as Context, 'test', 'payload')).resolves.toBeUndefined()
    })
  })

  describe('emitter middleware', () => {
    it('should add emitter to context', async () => {
      type EventPayloadMap = {
        test: string
      }
      const middleware = emitter<EventPayloadMap>()
      const context = {
        set: vi.fn(),
      } as unknown as Context
      const next = vi.fn()

      await middleware(context, next)

      expect(context.set).toHaveBeenCalledWith('emitter', expect.any(Object))
      expect(next).toHaveBeenCalled()
    })

    it('should create emitter with provided handlers', async () => {
      const handler = vi.fn()
      type EventPayloadMap = {
        test: string
      }
      const middleware = emitter<EventPayloadMap>({ test: [handler] })

      let capturedEmitter: Emitter<EventPayloadMap> | undefined
      const context = {
        set: vi.fn().mockImplementation((key, value) => {
          if (key === 'emitter') {
            capturedEmitter = value
          }
        }),
      } as unknown as Context
      const next = vi.fn()

      await middleware(context, next)

      expect(context.set).toHaveBeenCalledWith('emitter', expect.any(Object))
      expect(capturedEmitter).toBeDefined()

      capturedEmitter?.emit({} as Context, 'test', 'payload')
      expect(handler).toHaveBeenCalledWith({}, 'payload')
    })
  })

  describe('defineHandler', () => {
    it('should return the provided handler', () => {
      type EventPayloadMap = {
        test: number
      }
      const handler = (_c: Context, _payload: number) => {}
      const definedHandler = defineHandler<EventPayloadMap, 'test'>(handler)
      expect(definedHandler).toBe(handler)
    })
  })

  describe('defineHandlers', () => {
    it('should return the provided handlers object', () => {
      const handlers = {
        test: [(_c: Context, _payload: number) => {}],
      }
      const definedHandlers = defineHandlers(handlers)
      expect(definedHandlers).toBe(handlers)
    })
  })

  describe('type safety', () => {
    it('should enforce correct types for event payloads', () => {
      type EventPayloadMap = {
        numberEvent: number
        objectEvent: { id: string }
      }

      const ee = createEmitter<EventPayloadMap>()

      // These should compile without errors
      ee.on('numberEvent', (_c, payload) => {
        const _num: number = payload
      })
      ee.on('objectEvent', (_c, payload) => {
        const _id: string = payload.id
      })

      // @ts-expect-error - payload should be a number
      ee.emit('numberEvent', {} as Context, 'not a number')

      // @ts-expect-error - payload should be an object with an id property
      ee.emit('objectEvent', {} as Context, { wrongKey: 'value' })

      // These should compile without errors
      ee.emit({} as Context, 'numberEvent', 42)
      ee.emit({} as Context, 'objectEvent', { id: 'test' })
    })
  })
  describe('Hono request flow', () => {
    it('should work when assigning event handlers via middleware', async () => {
      type EventPayloadMap = {
        'todo:created': { id: string; text: string }
      }

      type Env = { Variables: { emitter: Emitter<EventPayloadMap> } }

      const handlers = defineHandlers<EventPayloadMap>({
        'todo:created': [vi.fn((_c, _payload) => {})],
      })

      const app = new Hono<Env>()

      app.use(emitter(handlers))
      const ee = createEmitter<{ sdf: string; adsf: number }>()
      ee.on('adsf', vi.fn())
      let currentContext = null
      app.post('/todo', (c) => {
        currentContext = c
        c.get('emitter').emit(c, 'todo:created', { id: '2', text: 'Buy milk' })
        return c.json({ message: 'Todo created' })
      })

      const res = await app.request('http://localhost/todo', { method: 'POST' })
      expect(res).not.toBeNull()
      expect(res.status).toBe(200)
      expect(handlers['todo:created']?.[0]).toHaveBeenCalledWith(currentContext, {
        id: '2',
        text: 'Buy milk',
      })
    })

    it('should work when assigning async event handlers via middleware', async () => {
      type EventPayloadMap = {
        'todo:created': { id: string; text: string }
      }

      type Env = { Variables: { emitter: Emitter<EventPayloadMap> } }

      const handlers = defineHandlers<EventPayloadMap>({
        'todo:created': [vi.fn(async (_c, _payload) => {})],
      })

      const app = new Hono<Env>()

      app.use(emitter(handlers))

      let currentContext = null
      app.post('/todo', async (c) => {
        currentContext = c
        await c.get('emitter').emitAsync(c, 'todo:created', { id: '2', text: 'Buy milk' })
        return c.json({ message: 'Todo created' })
      })

      const res = await app.request('http://localhost/todo', { method: 'POST' })
      expect(res).not.toBeNull()
      expect(res.status).toBe(200)
      expect(handlers['todo:created']?.[0]).toHaveBeenCalledWith(currentContext, {
        id: '2',
        text: 'Buy milk',
      })
    })
  })
})
