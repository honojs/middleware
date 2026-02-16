# `defineOpenAPIRoute` & `openapiRoutes` - Design Documentation

## Problems Before Introduction

### 1. **Repetitive Route Registration**

Before `openapiRoutes`, each route had to be registered individually using the `.openapi()` method:

```typescript
app.openapi(getUserRoute, getUserHandler)
app.openapi(createUserRoute, createUserHandler)
app.openapi(updateUserRoute, updateUserHandler)
app.openapi(deleteUserRoute, deleteUserHandler)
// ... potentially dozens more
```

This approach led to:

- Verbose, repetitive code
- Difficult maintenance when dealing with many routes
- Poor code organization and readability

### 2. **Type Inference Challenges**

When routes were defined inline or without proper type constraints, TypeScript struggled with:

- Inferring the correct handler signature from the route configuration
- Maintaining type safety across route definitions and handlers
- Providing accurate autocomplete for request/response types

```typescript
// Type inference could be lost here
const route = createRoute({
  method: 'get',
  path: '/users/{id}',
  // ... complex configuration
})

// Handler types might not be correctly inferred
app.openapi(route, (c) => {
  // Limited type safety for c.req.param('id'), c.req.json(), etc.
})
```

### 3. **Modular Route Organization Issues**

Organizing routes across multiple files was challenging:

- Routes had to be imported and registered one by one
- Type safety for RPC (Remote Procedure Call) support was difficult to maintain
- Schema merging for the entire API was fragmented

```typescript
// routes/users.ts
export const userRoutes = [route1, route2, route3]
export const userHandlers = [handler1, handler2, handler3]

// index.ts
import { userRoutes, userHandlers } from './routes/users'
userRoutes.forEach((route, i) => app.openapi(route, userHandlers[i])) // Error-prone!
```

### 4. **Conditional Route Registration**

No built-in way to conditionally include/exclude routes:

- Feature flags or environment-based route registration required custom logic
- Had to use conditional statements scattered throughout the codebase

### 5. **RPC Type Safety Limitations**

When routes were registered individually across different parts of the application:

- The cumulative schema type (`S`) was harder to track
- RPC client type generation was less reliable
- Type inference for chained route registrations was complex

---

## How These Features Solve The Issues

### `defineOpenAPIRoute` Solution

**Purpose:** Provides a type-safe wrapper for route definitions with explicit type annotations.

**Benefits:**

1. **Explicit Type Safety:** Ensures route configuration, handler, and hook are correctly typed
2. **Portable Definitions:** Routes can be defined in separate files and imported
3. **Conditional Registration:** The `addRoute` parameter allows fine-grained control
4. **Better IntelliSense:** IDEs can provide better autocomplete and type checking
5. **Documentation:** Serves as a clear contract between route definition and implementation

```typescript
// Explicit types ensure correctness
const getUserRoute = defineOpenAPIRoute({
  route: {
    method: 'get',
    path: '/users/{id}',
    request: {
      params: z.object({ id: z.string() }),
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ id: z.string(), name: z.string() }),
          },
        },
      },
    },
  },
  handler: (c) => {
    // Full type safety - c.req.valid('param').id is typed as string
    const id = c.req.valid('param').id
    return c.json({ id, name: 'John' }, 200)
  },
  addRoute: process.env.FEATURE_USERS === 'true', // Conditional inclusion
})
```

### `openapiRoutes` Solution

**Purpose:** Batch registration of multiple routes with full type safety and schema merging.

**Benefits:**

1. **Batch Registration:** Register multiple routes in a single call
2. **Type-Safe Schema Merging:** Uses `SchemaFromRoutes` recursive type to merge all route schemas correctly
3. **Maintained RPC Support:** Full type inference for RPC clients across all registered routes
4. **Cleaner Code:** Reduces boilerplate significantly
5. **Modular Organization:** Routes can be grouped logically and imported from different files
6. **Conditional Routes:** Respects the `addRoute` flag from each route definition

```typescript
// Single call registers all routes with full type safety
app.openapiRoutes([getUserRoute, createUserRoute, updateUserRoute, deleteUserRoute] as const) // 'as const' preserves tuple types for perfect inference
```

---

## Intended Use

### Basic Usage Pattern

```typescript
import { OpenAPIHono, defineOpenAPIRoute, createRoute, z } from '@hono/zod-openapi'

// Step 1: Define routes using defineOpenAPIRoute
const getUser = defineOpenAPIRoute({
  route: createRoute({
    method: 'get',
    path: '/users/{id}',
    request: {
      params: z.object({ id: z.string() }),
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ id: z.string(), name: z.string() }),
          },
        },
      },
    },
  }),
  handler: (c) => {
    const { id } = c.req.valid('param')
    return c.json({ id, name: 'John Doe' }, 200)
  },
})

const createUser = defineOpenAPIRoute({
  route: createRoute({
    method: 'post',
    path: '/users',
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({ name: z.string() }),
          },
        },
      },
    },
    responses: {
      201: {
        content: {
          'application/json': {
            schema: z.object({ id: z.string(), name: z.string() }),
          },
        },
      },
    },
  }),
  handler: async (c) => {
    const { name } = c.req.valid('json')
    const id = crypto.randomUUID()
    return c.json({ id, name }, 201)
  },
})

// Step 2: Register all routes at once
const app = new OpenAPIHono()
app.openapiRoutes([getUser, createUser] as const)
```

### Modular Organization Pattern

```typescript
// routes/users.ts
export const userRoutes = [
  defineOpenAPIRoute({ route: getUserRoute, handler: getUserHandler }),
  defineOpenAPIRoute({ route: listUsersRoute, handler: listUsersHandler }),
  defineOpenAPIRoute({ route: createUserRoute, handler: createUserHandler }),
] as const

// routes/posts.ts
export const postRoutes = [
  defineOpenAPIRoute({ route: getPostRoute, handler: getPostHandler }),
  defineOpenAPIRoute({ route: createPostRoute, handler: createPostHandler }),
] as const

// app.ts
import { userRoutes } from './routes/users'
import { postRoutes } from './routes/posts'

const app = new OpenAPIHono()
app.openapiRoutes([...userRoutes, ...postRoutes] as const)
```

### Conditional Routes Pattern

```typescript
const debugRoutes = [
  defineOpenAPIRoute({
    route: healthCheckRoute,
    handler: healthCheckHandler,
    addRoute: true, // Always included
  }),
  defineOpenAPIRoute({
    route: metricsRoute,
    handler: metricsHandler,
    addRoute: process.env.NODE_ENV === 'development', // Only in dev
  }),
  defineOpenAPIRoute({
    route: docsRoute,
    handler: docsHandler,
    addRoute: process.env.ENABLE_DOCS === 'true', // Feature flag
  }),
] as const

app.openapiRoutes(debugRoutes)
// Only routes with addRoute !== false are registered
```

### With Middleware Pattern

```typescript
const authMiddleware = /* ... */

const protectedRoutes = [
  defineOpenAPIRoute({
    route: {
      ...getUserProfileRoute,
      middleware: authMiddleware // Route-level middleware
    },
    handler: getUserProfileHandler
  })
] as const

app.openapiRoutes(protectedRoutes)
```

---

## Key Design Decisions

### 1. **`as const` Requirement**

The array must be defined as `as const` or inline to preserve tuple types. This is necessary for:

- Accurate type inference for each individual route
- Proper schema merging using recursive conditional types
- RPC client type generation

### 2. **`addRoute` Flag**

The optional `addRoute` parameter provides:

- Declarative conditional registration
- Route configuration and business logic in one place
- Cleaner alternative to wrapping routes in conditional statements

### 3. **Type-Only `defineOpenAPIRoute`**

The function is essentially a type identity function - it returns the input unchanged:

```typescript
export const defineOpenAPIRoute = <...>(def: OpenAPIRoute<...>): OpenAPIRoute<...> => {
  return def
}
```

Its primary purpose is to provide **explicit type annotations** and improve developer experience.

### 4. **Backward Compatibility**

Both features are **additive** and don't break existing code:

- `.openapi()` method still works as before
- Routes can be mixed: some registered with `.openapi()`, others with `.openapiRoutes()`
- No migration required for existing applications

---

## Summary

| Aspect                 | Before                        | After                                         |
| ---------------------- | ----------------------------- | --------------------------------------------- |
| **Registration**       | Individual `.openapi()` calls | Batch with `.openapiRoutes()`                 |
| **Type Safety**        | Manual handler typing         | Automatic inference with `defineOpenAPIRoute` |
| **Organization**       | Scattered, hard to modularize | Clean, modular structure                      |
| **Conditional Routes** | Manual if/else statements     | Declarative `addRoute` flag                   |
| **Code Volume**        | High repetition               | Minimal boilerplate                           |
| **RPC Support**        | Complex type merging          | Automatic schema merging                      |
| **Maintainability**    | Challenging with many routes  | Easy to manage at scale                       |

These features enable **scalable, type-safe, and maintainable** OpenAPI route management in Hono applications.
