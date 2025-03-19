# Event Emitter middleware for Hono

[![codecov](https://codecov.io/github/honojs/middleware/graph/badge.svg?flag=event-emitter)](https://codecov.io/github/honojs/middleware)

### Minimal, lightweight and edge compatible Event Emitter middleware for [Hono](https://github.com/honojs/hono).

## Table of Contents

1. [Introduction](#introduction)
2. [Installation](#installation)
3. [Usage Examples](#usage-examples)
   - [1. As Hono middleware](#1-as-hono-middleware)
   - [2. Standalone](#2-standalone)
4. [API Reference](#api-reference)
   - [emitter](#emitter)
   - [createEmitter](#createemitter)
   - [defineHandler](#definehandler)
   - [defineHandlers](#definehandlers)
   - [Emitter API Documentation](#emitter)
5. [Types](#types)

## Introduction

This library provides an event emitter middleware for Hono, allowing you to easily implement and manage event-driven architectures in your Hono applications.
It enables event driven logic flow, allowing you to decouple your code and make it more modular and maintainable.

Inspired by event emitter concept in other frameworks such
as [Adonis.js](https://docs.adonisjs.com/guides/emitter), [Nest.js](https://docs.nestjs.com/techniques/events), [Hapi.js](https://github.com/hapijs/podium), [Meteor](https://github.com/Meteor-Community-Packages/Meteor-EventEmitter) and others.

See [FAQ](#faq) bellow for some common questions.

For more usage examples, see the [tests](src/index.test.ts) or my [Hono REST API starter kit](https://github.com/DavidHavl/hono-rest-api-starter)

## Installation

```sh
npm install @hono/event-emitter
# or
yarn add @hono/event-emitter
# or
pnpm add @hono/event-emitter
# or
bun install @hono/event-emitter
```

## Usage

#### There are 2 ways you can use this with Hono:

### 1. As Hono middleware

```js
// event-handlers.js

// Define event handlers
export const handlers = {
  'user:created': [
    (c, payload) => {}, // c is current Context, payload is whatever the emit method passes
  ],
  'user:deleted': [
    async (c, payload) => {}, // c is current Context, payload is whatever the emit method passes
  ],
  foo: [
    (c, payload) => {}, // c is current Context, payload is whatever the emit method passes
  ],
}

// You can also define single event handler as named function
// export const fooHandler = (c, payload) => {
//   // c is current Context, payload is whatever the emit method passes
//   // ...
//   console.log('New foo created:', payload)
// }
```

```js
// app.js

import { emitter } from '@hono/event-emitter'
import { handlers, fooHandler } from './event-handlers'
import { Hono } from 'hono'

// Initialize the app with emitter type
const app = new Hono()

// Register the emitter middleware and provide it with the handlers
app.use(emitter(handlers))

// You can also add event listener inside middleware or route handler, but please only use named functions to prevent duplicates and memory leaks!
// app.use((c, next) => {
//   c.get('emitter').on('foo', fooHandler)
//   return next()
// })

// Routes
app.post('/users', (c) => {
  // ...
  // Emit event and pass current context plus the payload
  c.get('emitter').emit(c, 'user:created', user)
  // ...
})

app.delete('/users/:id', async (c) => {
  // ...
  // Emit event asynchronpusly and pass current context plus the payload
  await c.get('emitter').emitAsync(c, 'user:deleted', id)
  // ...
})

export default app
```

The emitter is available in the context as `emitter` key.

As seen above (commented out) you can also subscribe to events inside middlewares or route handlers,
but because middlewares are called on every request, you can only use named functions to prevent duplicates or memory leaks!

### 2 Standalone

```js
// events.js

import { createEmitter } from '@hono/event-emitter'

// Define event handlers
export const handlers = {
  'user:created': [
    (c, payload) => {}, // c is current Context, payload will be whatever you pass to emit method
  ],
  'user:deleted': [
    async (c, payload) => {}, // c is current Context, payload will be whatever you pass to emit method
  ],
}

// Initialize emitter with handlers
const ee = createEmitter(handlers)

// And you can add more listeners on the fly.
// Here you CAN use anonymous or closure function because .on() is only called once.
// ee.on('foo', async (c, payload) => {
//     console.log('New foo created:', payload)
// })

export default ee
```

```js
// app.js

import { Hono } from 'hono'
import ee from './events'

// Initialize the app
const app = new Hono()

app.post('/users', async (c) => {
  // ...
  // Emit event and pass current context plus the payload
  ee.emit(c, 'user:created', user)
  // ...
})

app.delete('/users/:id', async (c) => {
  // ...
  // Emit event and pass current context plus the payload
  await ee.emitAsync(c, 'user:deleted', id)
  // ...
})

export default app
```

## Typescript

### 1. As hono middleware

```ts
// types.ts

import type { Emitter } from '@hono/event-emitter'

export type User = {
  id: string
  title: string
  role: string
}

export type AvailableEvents = {
  // event key: payload type
  'user:created': User
  'user:deleted': string
  foo: { bar: number }
}

export type Env = {
  Bindings: {}
  Variables: {
    // Define emitter variable type
    emitter: Emitter<AvailableEvents>
  }
}
```

```ts
// event-handlers.ts

import { defineHandlers } from '@hono/event-emitter'
import { AvailableEvents } from './types'

// Define event handlers
export const handlers = defineHandlers<AvailableEvents>({
  'user:created': [
    (c, user) => {}, // c is current Context, payload will be correctly inferred as User
  ],
  'user:deleted': [
    async (c, payload) => {}, // c is current Context, payload will be inferred as string
  ],
})

// You can also define single event handler as named function using defineHandler to leverage typings
// export const fooHandler = defineHandler<AvailableEvents, 'foo'>((c, payload) => {
//   // c is current Context, payload will be inferred as { bar: number }
//   // ...
//   console.log('Foo:', payload)
// })
```

```ts
// app.ts

import { emitter, type Emitter, type EventHandlers } from '@hono/event-emitter'
import { handlers, fooHandler } from './event-handlers'
import { Hono } from 'hono'
import { Env } from './types'

// Initialize the app
const app = new Hono<Env>()

// Register the emitter middleware and provide it with the handlers
app.use(emitter(handlers))

// You can also add event listener inside middleware or route handler, but please only use named functions to prevent duplicates and memory leaks!
// app.use((c, next) => {
//   c.get('emitter').on('foo', fooHandler)
//   return next()
// })

// Routes
app.post('/user', async (c) => {
  // ...
  // Emit event and pass current context plus the payload (User type)
  c.get('emitter').emit(c, 'user:created', user)
  // ...
})

app.delete('/user/:id', async (c) => {
  // ...
  // Emit event and pass current context plus the payload (string)
  await c.get('emitter').emitAsync(c, 'user:deleted', id)
  // ...
})

export default app
```

The emitter is available in the context as `emitter` key.

As seen above (the commented out 'foo' event) you can also subscribe to events inside middlewares or route handlers,
but because middlewares are called on every request, you can only use named functions to prevent duplicates or memory leaks!

### 2. Standalone:

```ts
// types.ts

type User = {
  id: string
  title: string
  role: string
}

type AvailableEvents = {
  // event key: payload type
  'user:created': User
  'user:updated': User
  'user:deleted': string
  foo: { bar: number }
}
```

```ts
// events.ts

import {
  createEmitter,
  defineHandlers,
  type Emitter,
  type EventHandlers,
} from '@hono/event-emitter'
import { AvailableEvents } from './types'

// Define event handlers
export const handlers = defineHandlers<AvailableEvents>({
  'user:created': [
    (c, user) => {}, // c is current Context, payload will be correctly inferred as User
  ],
  'user:deleted': [
    async (c, payload) => {}, // c is current Context, payload will be inferred as string
  ],
})

// You can also define single event handler using defineHandler to leverage typings
// export const fooHandler = defineHandler<AvailableEvents, 'foo'>((c, payload) => {})

// Initialize emitter with handlers
const ee = createEmitter(handlers)

// ee.on('foo', fooHandler)

// And you can add more listeners on the fly.
// Here you can use anonymous or closure function because .on() is only called once.
ee.on('foo', async (c, payload) => {
  // Payload will be correctly inferred as User
  console.log('User updated:', payload)
})

export default ee
```

```ts
// app.ts

import ee from './events'
import { Hono } from 'hono'

// Initialize the app
const app = new Hono()

app.post('/user', async (c) => {
  // ...
  // Emit event and pass current context plus the payload (User)
  ee.emit(c, 'user:created', user)
  // ...
})

app.delete('/user/:id', async (c) => {
  // ...
  // Emit event and pass current context plus the payload (string)
  ee.emit(c, 'user:deleted', id)
  // ...
})

export default app
```

## API Reference

### emitter

Creates a Hono middleware that adds an event emitter to the context.

```ts
function emitter<EPMap extends EventPayloadMap>(
  eventHandlers?: EventHandlers<EPMap>,
  options?: EventEmitterOptions
): MiddlewareHandler
```

#### Parameters

- `eventHandlers` - (optional): An object containing initial event handlers. Each key is event name and value is array of event handlers. Use `defineHandlers` function to create fully typed event handlers.
- `options` - (optional): An object containing options for the emitter. Currently, the only option is `maxHandlers`, which is the maximum number of handlers that can be added to an event. The default is `10`.

#### Returns

A Hono middleware function that adds an `Emitter` instance to the context under the key 'emitter'.

#### Example

```ts
app.use(emitter(eventHandlers))
```

### createEmitter

Creates new instance of event emitter with provided handlers. This is usefull when you want to use the emitter as standalone feature instead of Hono middleware.

```ts
function createEmitter<EPMap extends EventPayloadMap>(
  eventHandlers?: EventHandlers<EPMap>,
  options?: EventEmitterOptions
): Emitter<EPMap>
```

#### Parameters

- `eventHandlers` - (optional): An object containing initial event handlers. Each key is event name and value is array of event handlers.
- `options` - (optional): An object containing options for the emitter. Currently, the only option is `maxHandlers`, which is the maximum number of handlers that can be added to an event. The default is `10`.

#### Returns

An `Emitter` instance:

#### Example

```ts
const ee = createEmitter(eventHandlers)
```

### defineHandler

A utility function to define a typed event handler.

```ts
function defineHandler<EPMap extends EventPayloadMap, Key extends keyof EPMap, E extends Env = Env>(
  handler: EventHandler<EPMap[Key], E>
): EventHandler<EPMap[Key], E>
```

#### Parameters

- `handler`: The event handler function to be defined.

#### Type parameters

- `EPMap`: The available event key to payload map i.e.: `type AvailableEvents = { 'user:created': { name: string } };`.
- `Key`: The key of the event type.
- `E`: (optional) - The Hono environment, so that the context within the handler has the right info.

#### Returns

The same event handler function with proper type inference.

#### Example

```ts
type AvailableEvents = {
  'user:created': { name: string }
}

const handler = defineHandler<AvailableEvents, 'user:created'>((c, payload) => {
  console.log('New user created:', payload)
})
```

### defineHandlers

A utility function to define multiple typed event handlers.

```ts
function defineHandlers<EPMap extends EventPayloadMap, E extends Env = Env>(handlers: {
  [K in keyof EPMap]?: EventHandler<EPMap[K], E>[]
}): { [K in keyof EPMap]?: EventHandler<EPMap[K], E>[] }
```

#### Parameters

- `handlers`: An object containing event handlers for multiple event types/keys.

#### Type parameters

- `EPMap`: The available event key to payload map i.e.: `type AvailableEvents = { 'user:created': { name: string } };`.
- `E`: (optional) - The Hono environment, so that the context within the handler has the right info.

#### Returns

The same handlers object with proper type inference.

#### Example

```ts
type AvailableEvents = {
  'user:created': { name: string }
}

const handlers = defineHandlers<AvailableEvents>({
  'user:created': [
    (c, payload) => {
      console.log('New user created:', pyload)
    },
  ],
})
```

## Emitter instance methods

The `Emitter` interface provides methods for managing and triggering events. Here's a detailed look at each method:

### on

Adds an event handler for the specified event key.

#### Signature

```ts
function on<Key extends keyof EventPayloadMap>(
  key: Key,
  handler: EventHandler<EventPayloadMap[Key]>
): void
```

#### Parameters

- `key`: The event key to listen for. Must be a key of `EventHandlerPayloads`.
- `handler`: The function to be called when the event is emitted. If using within a Hono middleware or request handler, do not use anonymous or closure functions!
  It should accept two parameters:
  - `c`: The current Hono context object.
  - `payload`: The payload passed when the event is emitted. The type of the payload is inferred from the `EventHandlerPayloads` type.

#### Returns

`void`

#### Example

Using outside the Hono middleware or request handler:

```ts
type AvailableEvents = {
  'user:created': { name: string }
}
const ee = createEmitter<AvailableEvents>()

// If adding event handler outside of Hono middleware or request handler, you can use both, named or anonymous function.
ee.on('user:created', (c, user) => {
  console.log('New user created:', user)
})
```

Using within Hono middleware or request handler:

```ts
type AvailableEvents = {
  'user:created': { name: string }
}

// Define event handler as named function, outside of the Hono middleware or request handler to prevent duplicates/memory leaks
const namedHandler = defineHandler<AvailableEvents, 'user:created'>((c, user) => {
  console.log('New user created:', user)
})

app.use(emitter<AvailableEvents>())

app.use((c, next) => {
  c.get('emitter').on('user:created', namedHandler)
  return next()
})
```

### off

Removes an event handler for the specified event key.

#### Signature

```ts
function off<Key extends keyof EventPayloadMap>(
  key: Key,
  handler?: EventHandler<EventPayloadMap[Key]>
): void
```

#### Parameters

- `key`: The event key to remove the handler from. Must be a key of `EventPayloadMap`.
- `handler` (optional): The specific handler function to remove. If not provided, all handlers for the given key will be removed.

#### Returns

`void`

#### Example

```ts
type AvailableEvents = {
  'user:created': { name: string }
}

const ee = createEmitter<AvailableEvents>()

const logUser = defineHandler<AvailableEvents, 'user:created'>((c, user) => {
  console.log(`User: ${user.name}`)
})

ee.on('user:created', logUser)

// Later, to remove the specific handler:
ee.off('user:created', logUser)

// Or to remove all handlers for 'user:created':
ee.off('user:created')
```

### emit

Synchronously emits an event with the specified key and payload.

#### Signature

```ts
emit<Key extends keyof EventPayloadMap>(
    c: Context,
    key: Key,
    payload: EventPayloadMap[Key]
): void
```

#### Parameters

- `c`: The current Hono context object.
- `key`: The event key to emit. Must be a key of `EventPayloadMap`.
- `payload`: The payload to pass to the event handlers. The type of the payload is inferred from the `EventPayloadMap` type.

#### Returns

`void`

#### Example

```ts
app.post('/users', (c) => {
  const user = { name: 'Alice' }
  c.get('emitter').emit(c, 'user:created', user)
})
```

### emitAsync

Asynchronously emits an event with the specified key and payload.

#### Signature

```ts
emitAsync<Key extends keyof EventPayloadMap>(
    c: Context,
    key: Key,
    payload: EventPayloadMap[Key],
    options?: EmitAsyncOptions
): Promise<void>
```

#### Parameters

- `c`: The current Hono context object.
- `key`: The event key to emit. Must be a key of `EventPayloadMap`.
- `payload`: The payload to pass to the event handlers. The type of the payload is inferred from the `EventPayloadMap` type.
- `options` (optional): An object containing options for the asynchronous emission.
  Currently, the only option is `mode`, which can be `'concurrent'` (default) or `'sequencial'`.
  - The `'concurrent'` mode will call all handlers concurrently (at the same time) and resolve or reject (with aggregated errors) after all handlers settle.
  - The `'sequencial'` mode will call handlers one by one and resolve when all handlers are done or reject when the first error is thrown, not executing rest of the handlers.

#### Returns

`Promise<void>`

#### Example

```ts
app.post('/users', async (c) => {
  const user = { name: 'Alice' }
  await c.get('emitter').emitAsync(c, 'user:created', user)
  // await c.get('emitter').emitAsync(c, 'user:created', user, { mode: 'sequencial' });
})
```

## Types

### EventKey

A string literal type representing an event key.

```ts
type EventKey = string | symbol
```

### EventHandler

A function type that handles an event.

```ts
type EventHandler<T, E extends Env = Env> = (c: Context<E>, payload: T) => void | Promise<void>
```

### EventHandlers

An object type containing event handlers for multiple event types/keys.

```ts
type EventHandlers<T, E extends Env = Env> = { [K in keyof T]?: EventHandler<T[K], E>[] }
```

### EventPayloadMap

An object type containing event keys and their corresponding payload types.

```ts
type EventPayloadMap = Record<EventKey, any>
```

### EventEmitterOptions

An object type containing options for the `Emitter` class.

```ts
type EventEmitterOptions = { maxHandlers?: number }
```

### EmitAsyncOptions

An object type containing options for the `emitAsync` method.

```ts
type EmitAsyncOptions = {
  mode?: 'concurrent' | 'sequencial'
}
```

### Emitter

An interface representing an event emitter.

```ts
interface Emitter<EventPayloadMap> {
  on<Key extends keyof EventPayloadMap>(key: Key, handler: EventHandler<EventPayloadMap[Key]>): void
  off<Key extends keyof EventPayloadMap>(
    key: Key,
    handler?: EventHandler<EventPayloadMap[Key]>
  ): void
  emit<Key extends keyof EventPayloadMap>(c: Context, key: Key, payload: EventPayloadMap[Key]): void
  emitAsync<Key extends keyof EventPayloadMap>(
    c: Context,
    key: Key,
    payload: EventPayloadMap[Key],
    options?: EmitAsyncOptions
  ): Promise<void>
}
```

For more usage examples, see the [tests](src/index.test.ts) or [Hono REST API starter kit](https://github.com/DavidHavl/hono-rest-api-starter)

## FAQ

### What the heck is event emitter and why should I use it?

Event emitter is a pattern that allows you to decouple your code and make it more modular and maintainable.
It's a way to implement the observer pattern in your application.
It's especially useful in larger projects or projects with a lot of interactions between features.
Just imagine you have a user registration feature, and you want to send a welcome email after the user is created. You can do this by emitting an event `user:created` and then listen to this event in another part of your application (e.g. email service).

### How is this different to the built-in EventEmitter in Node.js?

The build-in EventEmitter has huge API surface, weak TypeScript support and does only synchronous event emitting. Hono's event emitter is designed to be minimal, lightweight, edge compatible and fully typed. Additionally, it supports async event handlers.

### Is there a way to define event handlers with types?

Yes, you can use `defineHandlers` and `defineHandler` functions to define event handlers with types. This way you can leverage TypeScript's type inference and get better type checking.

### Does it support async event handlers?

Yes, it does. You can use async functions as event handlers and emit the events using `emitAsync` method.

### What happens if I emit an event that has no handlers?

Nothing. The event will be emitted, but no handlers will be called.

### Using `emitAsync` function, what happens if one or more of the handlers reject?

- If using `{ mode = 'concurrent' }` in the options (which is the default), it will call all handlers concurrently (at the same time) and resolve or reject (with aggregated errors) after all handlers settle.
- If using `{ mode = 'sequencial' }` in the options, it will call handlers one by one and resolve when all handlers are done or reject when the first error is thrown, not executing rest of the handlers.

### Is it request scoped?

No, by design it's not request scoped. The same Emitter instance is shared across all requests.
This aproach prevents memory leaks (especially when using closures or dealing with large data structures within the handlers) and additional strain on Javascript garbage collector.

### Why can't I use anonymous functions or closures as event handlers when adding them inside of middleware?

This is because middleware or request handlers run repeatedly on every request, and because anonymous functions are created as new unique object in memory every time,
you would be instructing the event emitter to add new handler for same key every time the request/middleware runs.
Since they are each different objects in memory they can't be checked for equality and would result in memory leaks and duplicate handlers.
You should use named functions if you really want to use the `on()` method inside of middleware or request handler.

## Author

David Havl <https://github.com/DavidHavl>

## License

MIT
