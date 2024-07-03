# Event Emitter middleware for Hono

Minimal, lightweight and edge compatible Event Emitter middleware for [Hono](https://github.com/honojs/hono).

It enables event driven logic flow in hono applications (essential in larger projects or projects with a lot of interactions between features).

Inspired by event emitter concept in other frameworks such
as [Adonis.js](https://docs.adonisjs.com/guides/emitter), [Nest.js](https://docs.nestjs.com/techniques/events), [Hapi.js](https://github.com/hapijs/podium), [Laravel](https://laravel.com/docs/11.x/events), [Sails.js](https://sailsjs.com/documentation/concepts/extending-sails/hooks/events), [Meteor](https://github.com/Meteor-Community-Packages/Meteor-EventEmitter) and others.


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
    (c, payload) => {} // c is current Context, payload will be correctly inferred as User
  ],
  'user:deleted': [
    (c, payload) => {} // c is current Context, payload will be inferred as string
  ],
  'foo': [
    (c, payload) => {} // c is current Context, payload will be inferred as { bar: number }
  ]
}

// You can also define single event handler as named function
// export const userCreatedHandler = (c, user) => {
//   // c is current Context, payload will be inferred as User
//   // ...
//   console.log('New user created:', user)
// }

```

```js
// app.js

import { emitter } from '@hono/event-emitter'
import { handlers, userCreatedHandler } from './event-handlers'
import { Hono } from 'hono'

// Initialize the app with emitter type
const app = new Hono()

// Register the emitter middleware and provide it with the handlers
app.use('*', emitter(handlers))

// You can also setup "named function" as event listener inside middleware or route handler
// app.use((c, next) => {
//   c.get('emitter').on('user:created', userCreatedHandler)
//   return next()
// })

// Routes
app.post('/user', async (c) => {
  // ...
  // Emit event and pass current context plus the payload
  c.get('emitter').emit('user:created', c, user)
  // ...
})

app.delete('/user/:id', async (c) => {
  // ...
  // Emit event and pass current context plus the payload
  c.get('emitter').emit('user:deleted', c, id)
  // ...
})

export default app
```

The emitter is available in the context as `emitter` key, and handlers (when using named functions) will only be subscribed to events once, even if the middleware is called multiple times.

As seen above (commented out) you can also subscribe to events inside middlewares or route handlers, but you can only use named functions to prevent duplicates!

### 2 Standalone


```js
// events.js

import { createEmitter } from '@hono/event-emitter'

// Define event handlers
export const handlers = {
  'user:created': [
    (c, payload) => {} // c is current Context, payload will be whatever you pass to emit method
  ],
  'user:deleted': [
    (c, payload) => {} // c is current Context, payload will be whatever you pass to emit method
  ],
  'foo': [
    (c, payload) => {} // c is current Context, payload will be whatever you pass to emit method
  ]
}

// Initialize emitter with handlers
const emitter = createEmitter(handlers)

// And you can add more listeners on the fly.
// Here you CAN use anonymous or closure function because .on() is only called once.
emitter.on('user:updated', (c, payload) => {
    console.log('User updated:', payload)
})

export default emitter

```

```js
// app.js

import emitter from './events'
import { Hono } from 'hono'

// Initialize the app
const app = new Hono()

app.post('/user', async (c) => {
    // ...
    // Emit event and pass current context plus the payload
    emitter.emit('user:created', c, user)
    // ...
})

app.delete('/user/:id', async (c) => {
    // ...
    // Emit event and pass current context plus the payload
    emitter.emit('user:deleted', c, id )
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
    id: string,
    title: string,
    role: string
}

export type AvailableEvents = {
    // event key: payload type
    'user:created': User;
    'user:deleted': string;
    'foo': { bar: number };
};

export type Env = {
    Bindings: {};
    Variables: {
        // Define emitter variable type
        emitter: Emitter<AvailableEvents>;
    };
};


```

```ts
// event-handlers.ts

import { defineHandlers } from '@hono/event-emitter'
import { AvailableEvents } from './types'

// Define event handlers
export const handlers = defineHandlers<AvailableEvents>({
  'user:created': [
    (c, user) => {} // c is current Context, payload will be correctly inferred as User
  ],
  'user:deleted': [
    (c, payload) => {} // c is current Context, payload will be inferred as string
  ],
  'foo': [
    (c, payload) => {} // c is current Context, payload will be inferred as { bar: number }
  ]
})

// You can also define single event handler as named function using defineHandler to leverage typings
// export const userCreatedHandler = defineHandler<AvailableEvents, 'user:created'>((c, user) => {
//   // c is current Context, payload will be inferred as User
//   // ...
//   console.log('New user created:', user)
// })

```

```ts
// app.ts

import { emitter, type Emitter, type EventHandlers } from '@hono/event-emitter'
import { handlers, userCreatedHandler } from './event-handlers'
import { Hono } from 'hono'
import { Env } from './types'

// Initialize the app
const app = new Hono<Env>()

// Register the emitter middleware and provide it with the handlers
app.use('*', emitter(handlers))

// You can also setup "named function" as event listener inside middleware or route handler
// app.use((c, next) => {
//   c.get('emitter').on('user:created', userCreatedHandler)
//   return next()
// })

// Routes
app.post('/user', async (c) => {
  // ...
  // Emit event and pass current context plus the payload (User type)
  c.get('emitter').emit('user:created', c, user)
  // ...
})

app.delete('/user/:id', async (c) => {
  // ...
  // Emit event and pass current context plus the payload (string)
  c.get('emitter').emit('user:deleted', c, id)
  // ...
})

export default app
```

### 2. Standalone:

```ts
// types.ts

type User = {
  id: string,
  title: string,
  role: string
}

type AvailableEvents = {
  // event key: payload type
  'user:created': User;
  'user:updated': User;
  'user:deleted': string,
  'foo': { bar: number };
}

```

```ts
// events.ts

import { createEmitter, defineHandlers, type Emitter, type EventHandlers } from '@hono/event-emitter'
import { AvailableEvents } from './types'

// Define event handlers
export const handlers = defineHandlers<AvailableEvents>({
  'user:created': [
    (c, user) => {} // c is current Context, payload will be correctly inferred as User
  ],
  'user:deleted': [
    (c, payload) => {} // c is current Context, payload will be inferred as string
  ],
  'foo': [
    (c, payload) => {} // c is current Context, payload will be inferred as { bar: number }
  ]
})

// You can also define single event handler using defineHandler to leverage typings
// export const userCreatedHandler = defineHandler<AvailableEvents, 'user:created'>((c, payload) => {
//     // c is current Context, payload will be correctly inferred as User
//     // ...
//     console.log('New user created:', payload)
// })

// Initialize emitter with handlers
const emitter = createEmitter(handlers)

// emitter.on('user:created', userCreatedHandler)

// And you can add more listeners on the fly.
// Here you can use anonymous or closure function because .on() is only called once.
emitter.on('user:updated', (c, payload) => { // Payload will be correctly inferred as User
    console.log('User updated:', payload)
})

export default emitter

```

```ts
// app.ts

import emitter from './events'
import { Hono } from 'hono'

// Initialize the app
const app = new Hono()

app.post('/user', async (c) => {
  // ...
  // Emit event and pass current context plus the payload (User)
  emitter.emit('user:created', c, user)
  // ...
})

app.delete('/user/:id', async (c) => {
  // ...
  // Emit event and pass current context plus the payload (string)
  emitter.emit('user:deleted', c, id )
  // ...
})

export default app
```



### NOTE:

When assigning event handlers inside of middleware or route handlers, don't use anonymous or closure functions, only named functions!
This is because anonymous functions or closures in javascript are created as new object every time and therefore can't be easily checked for equality/duplicates.


For more usage examples, see the [tests](src/index.test.ts) or [Hono REST API starter kit](https://github.com/DavidHavl/hono-rest-api-starter)

## Author

- David Havl - <https://github.com/DavidHavl>

## License

MIT
