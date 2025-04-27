/**
 * @module
 * Event Emitter Middleware for Hono.
 */

import type { Context, Env, MiddlewareHandler } from 'hono'

export type EventKey = string | symbol
export type EventHandler<T, E extends Env = Env> = (
  c: Context<E>,
  payload: T
) => void | Promise<void>
export type EventHandlers<T> = { [K in keyof T]?: EventHandler<T[K]>[] }
export type EventPayloadMap = { [key: string]: unknown }
export type EmitAsyncOptions = { mode: 'concurrent' | 'sequencial' }
export type EventEmitterOptions = { maxHandlers?: number }

export interface Emitter<EPMap extends EventPayloadMap> {
  on<Key extends keyof EPMap>(key: Key, handler: EventHandler<EPMap[Key]>): void
  off<Key extends keyof EPMap>(key: Key, handler?: EventHandler<EPMap[Key]>): void
  emit<Key extends keyof EPMap>(c: Context, key: Key, payload: EPMap[Key]): void
  emitAsync<Key extends keyof EPMap>(
    c: Context,
    key: Key,
    payload: EPMap[Key],
    options?: EmitAsyncOptions
  ): Promise<void>
}

/**
 * Function to define fully typed event handler.
 * @param {EventHandler} handler - The event handlers.
 * @returns The event handler.
 */
export const defineHandler = <
  EPMap extends EventPayloadMap,
  Key extends keyof EPMap,
  E extends Env = Env,
>(
  handler: EventHandler<EPMap[Key], E>
): EventHandler<EPMap[Key], E> => {
  return handler
}

/**
 * Function to define fully typed event handlers.
 * @param {EventHandler[]} handlers - An object where each key is an event type and the value is an array of event handlers.
 * @returns The event handlers.
 */
export const defineHandlers = <EPMap extends EventPayloadMap, E extends Env = Env>(handlers: {
  [K in keyof EPMap]?: EventHandler<EPMap[K], E>[]
}): { [K in keyof EPMap]?: EventHandler<EPMap[K], E>[] } => {
  return handlers
}

/**
 * Create Event Emitter instance.
 *
 * @template EPMap - The event payload map.
 * @param {EventHandlers<EPMap>} [eventHandlers] - Event handlers to be registered.
 * @param {EventEmitterOptions} [options] - Options for the event emitter.
 * @returns {Emitter} The EventEmitter instance.
 *
 * @example
 * ```js
 * // Define event handlers
 * const handlers: {
 *   'foo': [
 *     (c, payload) => { console.log('Foo:', payload) }
 *   ]
 * }
 *
 * // Initialize emitter with handlers
 * const ee = createEmitter(handlers)
 *
 * // AND/OR add more listeners on the fly.
 * ee.on('bar', (c, payload) => {
 *   c.get('logger').log('Bar:', payload.item.id)
 * })
 *
 * ee.on('baz', async (c, payload) => {
 *  // Do something async
 * })
 *
 * // Use the emitter to emit events.
 * ee.emit(c, 'foo', 42)
 * ee.emit(c, 'bar', { item: { id: '12345678' } })
 * await ee.emitAsync(c, 'baz', { item: { id: '12345678' } })
 * ```
 *
 * ```ts
 * type AvailableEvents = {
 *   // event key: payload type
 *   'foo': number;
 *   'bar': { item: { id: string } };
 *   'baz': { item: { id: string } };
 * };
 *
 * // Define event handlers
 * const handlers: defineHandlers<AvailableEvents>({
 *   'foo': [
 *     (c, payload) => { console.log('Foo:', payload) }  // payload will be inferred as number
 *   ]
 * })
 *
 * // Initialize emitter with handlers
 * const ee = createEmitter(handlers)
 *
 * // AND/OR add more listeners on the fly.
 * ee.on('bar', (c, payload) => {
 *   c.get('logger').log('Bar:', payload.item.id)
 * })
 *
 * ee.on('baz', async (c, payload) => {
 *  // Do something async
 * })
 *
 * // Use the emitter to emit events.
 * ee.emit(c, 'foo', 42) // Payload will be expected to be of a type number
 * ee.emit(c, 'bar', { item: { id: '12345678' } }) // Payload will be expected to be of a type { item: { id: string }, c: Context }
 * await ee.emitAsync(c, 'baz', { item: { id: '12345678' } }) // Payload will be expected to be of a type { item: { id: string } }
 * ```
 *
 */
export const createEmitter = <EPMap extends EventPayloadMap>(
  eventHandlers?: EventHandlers<EPMap>,
  options?: EventEmitterOptions
): Emitter<EPMap> => {
  // A map of event keys and their corresponding event handlers.
  const handlers: Map<EventKey, EventHandler<unknown>[]> = eventHandlers
    ? new Map(Object.entries(eventHandlers))
    : new Map()

  return {
    /**
     * Add an event handler for the given event key.
     * @param {string|symbol} key Type of event to listen for
     * @param {Function} handler Function that is invoked when the specified event occurs
     * @throws {TypeError} If the handler is not a function
     */
    on<Key extends keyof EPMap>(key: Key, handler: EventHandler<EPMap[Key]>) {
      if (typeof handler !== 'function') {
        throw new TypeError('The handler must be a function')
      }
      if (!handlers.has(key as EventKey)) {
        handlers.set(key as EventKey, [])
      }
      const handlerArray = handlers.get(key as EventKey) as Array<EventHandler<EPMap[Key]>>
      const limit = options?.maxHandlers ?? 10
      if (handlerArray.length >= limit) {
        throw new RangeError(
          `Max handlers limit (${limit}) reached for the event "${String(key)}". 
          This may indicate a memory leak, 
          perhaps due to adding anonymous function as handler within middleware or request handler.
          Check your code or consider increasing limit using options.maxHandlers.`
        )
      }
      if (!handlerArray.includes(handler)) {
        handlerArray.push(handler)
      }
    },

    /**
     * Remove an event handler for the given event key.
     * If `handler` is undefined, all handlers for the given key are removed.
     * @param {string|symbol} key Type of event to unregister `handler` from
     * @param {Function} handler - Handler function to remove
     */
    off<Key extends keyof EPMap>(key: Key, handler?: EventHandler<EPMap[Key]>) {
      if (!handler) {
        handlers.delete(key as EventKey)
      } else {
        const handlerArray = handlers.get(key as EventKey)
        if (handlerArray) {
          handlers.set(
            key as EventKey,
            handlerArray.filter((h) => h !== handler)
          )
        }
      }
    },

    /**
     * Emit an event with the given event key and payload.
     * Triggers all event handlers associated with the specified key.
     * @param {Context} c - The current context object
     * @param {string|symbol} key - The event key
     * @param {EventPayloadMap[keyof EventPayloadMap]} payload - Data passed to each invoked handler
     */
    emit<Key extends keyof EPMap>(c: Context, key: Key, payload: EPMap[Key]) {
      const handlerArray = handlers.get(key as EventKey)
      if (handlerArray) {
        for (const handler of handlerArray) {
          handler(c, payload)
        }
      }
    },

    /**
     * Emit an event with the given event key and payload.
     * Asynchronously triggers all event handlers associated with the specified key.
     * @param {Context} c - The current context object
     * @param {string|symbol} key - The event key
     * @param {EventPayloadMap[keyof EventPayloadMap]} payload - Data passed to each invoked handler
     * @param {EmitAsyncOptions} options - Options.
     * @throws {AggregateError} If any handler encounters an error.
     */
    async emitAsync<Key extends keyof EPMap>(
      c: Context,
      key: Key,
      payload: EPMap[Key],
      options: EmitAsyncOptions = { mode: 'concurrent' }
    ) {
      const handlerArray = handlers.get(key as EventKey)
      if (handlerArray) {
        if (options.mode === 'sequencial') {
          for (const handler of handlerArray) {
            await handler(c, payload)
          }
        } else {
          const results = await Promise.allSettled(
            handlerArray.map(async (handler) => {
              await handler(c, payload)
            })
          )
          const errors = (
            results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[]
          ).map((e) => e.reason)
          if (errors.length > 0) {
            throw new AggregateError(
              errors,
              `${errors.length} handler(s) for event ${String(key)} encountered errors`
            )
          }
        }
      }
    },
  }
}

/**
 * Event Emitter Middleware for Hono.
 *
 * @see {@link https://github.com/honojs/middleware/tree/main/packages/event-emitter}
 *
 * @template EPMap - The event payload map.
 * @param {EventHandlers<EPMap>} [eventHandlers] - Event handlers to be registered.
 * @param {EventEmitterOptions} [options] - Options for the event emitter.
 * @returns {MiddlewareHandler} The middleware handler function.
 *
 * @example
 * ```js
 *
 * // Define event handlers
 * const handlers: {
 *   'foo': [
 *     (c, payload) => { console.log('Foo:', payload) }
 *   ],
 *   'bar': [
 *     (c, payload) => { console.log('Bar:', payload.item.id) }
 *   ],
 *   'baz': [
 *     async (c, payload) => {
 *       // Do something async
 *     }
 *   ]
 * }
 *
 * const app = new Hono()
 *
 * // Register the emitter middleware and provide it with the handlers
 * app.use('\*', emitter(handlers))
 *
 * // Use the emitter in route handlers to emit events.
 * app.post('/foo', async (c) => {
 *   // The emitter is available under "emitter" key in the context.
 *   c.get('emitter').emit(c, 'foo', 42)
 *   c.get('emitter').emit(c, 'bar', { item: { id: '12345678' } })
 *   await c.get('emitter').emitAsync(c, 'baz', { item: { id: '12345678' } })
 *   return c.text('Success')
 * })
 * ```
 *
 * ```ts
 * type AvailableEvents = {
 *   // event key: payload type
 *   'foo': number;
 *   'bar': { item: { id: string } };
 *   'baz': { item: { id: string } };
 * };
 *
 * type Env = { Bindings: {}; Variables: { emitter: Emitter<AvailableEvents> }; }
 *
 * // Define event handlers
 * const handlers: defineHandlers<AvailableEvents>({
 *   'foo': [
 *     (c, payload) => { console.log('Foo:', payload) }  // payload will be inferred as number
 *   ],
 *   'bar': [
 *     (c, payload) => { console.log('Bar:', payload.item.id) }  // payload will be inferred as { item: { id: string } }
 *   ],
 *   'baz': [
 *     async (c, payload) => {
 *       // Do something async
 *     }
 *   ]
 * })
 *
 * const app = new Hono<Env>()
 *
 * // Register the emitter middleware and provide it with the handlers
 * app.use('\*', emitter(handlers))
 *
 * // Use the emitter in route handlers to emit events.
 * app.post('/foo', async (c) => {
 *   // The emitter is available under "emitter" key in the context.
 *   c.get('emitter').emit(c, 'foo', 42) // Payload will be expected to be of a type number
 *   c.get('emitter').emit(c, 'bar', { item: { id: '12345678' } }) // Payload will be expected to be of a type { item: { id: string } }
 *   await c.get('emitter').emitAsync(c, 'baz', { item: { id: '12345678' } }) // Payload will be expected to be of a type { item: { id: string } }
 *   return c.text('Success')
 * })
 * ```
 */
export const emitter = <EPMap extends EventPayloadMap>(
  eventHandlers?: EventHandlers<EPMap>,
  options?: EventEmitterOptions
): MiddlewareHandler => {
  // Create new instance to share with any middleware and handlers
  const instance = createEmitter<EPMap>(eventHandlers, options)
  return async (c, next) => {
    c.set('emitter', instance)
    await next()
  }
}
